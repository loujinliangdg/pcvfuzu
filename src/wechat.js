
const {ipcRenderer} = require('electron')
const fs = require('fs');
const API_HOST = require('./API_HOST').api_host;
const POLL_DELAY = 5000;
const axios = require('./utils/axios')
const KeepAlive = require('./keepAlive')
const LocalFriendManagement = require('./localFriendManagement')
var watchat = null;
var keepAlive = null;
var loopTimes = 0; //轮询次数
var bianlaLoginResult = null;



class Wachat{
    constructor(){
        // 新增（去重后的）好友列表
        this.newFriendArray = [];
        // 用户的报告｛name:'报告'｝
        this.healthReports = {};
    }
    init(){
        this.verifyIsHaveNewFriend();
        return this;
    }
    /**
     * 
     * @param {string} html 好友昵称 有可能包含span标签空格等
     * @return {string} 返回一个删除空白字符，及表情的字符串
     *  
     */
    replaceEmojiAndBlank(html){
        return html.replace(/<span [^>]+><\/span>/g,'').replace(/\s/g,''); //后面一个replace替换名字中有微信表示的，替换为空字符串
    }
    /**
     * 没有好友申请
     */
    noHaveNewFriendApply(){
        console.log('没有好友申请')
    }
    // 阻止用户操作
    preventUserDoAnyThing(){
        // TODO:阻止用户操作，这先不做，后续再加

        setTimeout(() =>{
            this.lookNewFriendList();
        })
    }
    /**
     * 查看好友请求列表，并去重
     */
    lookNewFriendList(){
        var newFriendList = this.getNewFriendList();
        // 如果新增好友列表里没东西 则继续下一次轮询吧
        if(!newFriendList){
            watchat = null;
            watchat = new Wachat().init();
            return;
        }
        else{
            // watchat = null;
            // watchat = new Wachat().init();
            let iterator = this.newFriendListIterator(newFriendList);
            // 先验证这个是否已经添加过
            this.verfiyIsAlreadyAdd(iterator)
        }
    }
    // 验证这条消息是是否已经添加为好友
    verfiyIsAlreadyAdd(iterator){
        var iteratorItem = iterator.next();
        if(!iteratorItem.done){
            let item = iteratorItem.value;
            let friendNickname = this.replaceEmojiAndBlank(item.querySelector('.display_name').innerHTML);
            let headImage = item.querySelector('.card_avatar > img').src;
            // 如果这个好友在本地添加过 ，则去迭代下一个
            if(LocalFriendManagement.hasFriend(friendNickname,headImage)){
                this.verfiyIsAlreadyAdd(iterator);
            }
            else{
                item.querySelector('.bubble.js_message_bubble.ng-scope.bubble_default.left .card').click();
                setTimeout(() =>{
                    var addButton = this.getAddFriendButtn();
                    // 理论上来讲可以不要这个判断，如果sessionStorage没有这个人，他应该是未添加的人
                    // 但经销商可能会在手机上手动通过好友申请，那么这时候，这个人就是已经是添加的状态
                    // 那么这个addButton就可能是不存在的，所以这一块的检查还是必要的
                    if(!addButton){
                        this.verfiyIsAlreadyAdd(iterator);
                    }
                    // 这个没添加过，那么就应该验证这个人是否来自一体机了
                    else{
                        this.verfiyIsFromXiaoWei(iterator,item)
                    }
                },500)
            }
        }
        else{
            watchat = null;
            watchat = new Wachat().init();
        }
    }
    /**
     * 验证这些新加好友是否来自一体机
     */
    verfiyIsFromXiaoWei(iterator,msgItemElement){
        var friendNickname = this.replaceEmojiAndBlank(msgItemElement.querySelector('.display_name').innerHTML);
        var headImage = msgItemElement.querySelector('.card_avatar > img').src;
        /**
         * 跟据微信昵称检查他是否是一体机过来的人，如果是，则自动通过
         */
        var bianlaId = bianlaLoginResult.data.bianla_id;
        axios.get(`${API_HOST}/api/vhelper/addFriendByPC`,{params:{bianlaId:bianlaId,friendNickname:friendNickname}})
        .then((result) =>{
            // 来自一体机 
            if(result.code === 1){
                let addButton = this.getAddFriendButtn();
                let healthReport = `${friendNickname}的报告` || result.data.healthLogUrl;
                //经向后台检验，这个人来自一体机 主动点击添加好友按钮 + 添加好友
                addButton.click(); 
                setTimeout(()=> {
                    // TODO:1500秒这里可能网不好的时候 可能不一定能添加完成，那么下面的sendMsgButton可能就不会出现
                    // 已添加好友存入本地(sessionStorage)
                    LocalFriendManagement.addFriend({
                        friendName:friendNickname,
                        headImage:headImage
                    });
                    msgItemElement.querySelector('.bubble.js_message_bubble.ng-scope.bubble_default.left .card').click();
                    // 发送消息
                    setTimeout(() =>{
                        // 发起聊天按钮
                        var sendMsgButton = document.querySelector('#mmpop_profile .web_wechat_tab_launch-chat');
                        if(sendMsgButton){
                            sendMsgButton.click();
                            this.sendHealthReport(healthReport)
                        }
                        // 理论上不会走这里，如果走了就会少发一个报告
                        else{
                            console.log(`${friendNickName}没有发报告,很可能是网络问题呀（在我想给他发报告的时候还没有添加成功）`)
                            this.verfiyIsAlreadyAdd(iterator)
                        }
                    },750)
                },1500)
            }
            else{
                this.verfiyIsAlreadyAdd(iterator);
            }
            
        })
        .catch((error) =>{
            console.log(error);
            // 不知道发生了什么错误那么,先不管了，迭代下一个新增好友
            this.verfiyIsAlreadyAdd(iterator);
        })
    }
    /**
     * 迭代报告列表，给新增好友发送报告 
     */
    toSendHealthReport(){
        setTimeout(() =>{
            var iterator = this.healthReportsIterator();
            this.sendHealthReport(iterator);
        },1500)
    }
    sendHealthReport(healthReport){
        setTimeout(() =>{
            let editArea = document.querySelector("#editArea");
            editArea.innerHTML = healthReport;
            editArea.setAttribute("autofocus",'');
            editArea.focus();
            var evt = document.createEvent('Event');
            evt.initEvent('input', true, true);
            editArea.dispatchEvent(evt); 
            // 点击发送消息 给新增好友好送报告
            document.querySelector('.btn.btn_send').click();
            console.log('报告发送完毕');

            watchat = null;
            watchat = new Wachat().init();
        })
    }

    /**
     * 迭代器 来迭代新增好友列表的
     */
    *newFriendListIterator(newFriendList){
        for(let i=0; i<newFriendList.length;i++){
            yield newFriendList[i];
        }
    }
    /**
     * 迭代器 来迭代报告列表
     */
    *healthReportsIterator(){
        for(let key in this.healthReports){
            yield {
                friendNickname:key,
                healthReport:this.healthReports[key]
            }
        }
    }
    getFriendRecommendMsgElement(){
        var chatList = [].slice.call(document.querySelectorAll('#J_NavChatScrollBody > div > div')).filter((item) =>{
            if(!/(?:top|bottom)-placeholder/.test(item.className)){
                if(/朋友推荐消息/.test(item.innerHTML)){
                    return true;
                }
                else{
                    return false;
                }
            }
            else{
                return false;
            }
        })
        var item = chatList[0];
        return item; //Element || null
    }
    getNewFriendList(){
        var textareaTitle = document.querySelector('#chatArea > .box_hd').innerHTML;
        if(/朋友推荐消息/.test(textareaTitle)){
            var Container = document.querySelector('.scroll-wrapper.box_bd.chat_bd.scrollbar-dynamic > .box_bd.chat_bd.scrollbar-dynamic.scroll-content > div');
            // 如果有这个容器
            if(Container){
                // 有未处理的好友请求
                if(/<p>朋友验证请求<\/p>/.test(Container.innerHTML)){
                    var newFriendList = [].slice.call(Container.children).filter((item) =>{
                        if(!/(?:top|bottom)-placeholder/.test(item.className)){
                            return true;
                        }
                        else{
                            return false;
                        }
                    })
                    return newFriendList;
                    // // 遍历添加请求的好友列表
                    // newFriendList.forEach((item,index) =>{
                    //     if(!this.newFriendArray.length){
                    //         this.newFriendArray.push(item);
                    //     }
                    //     else{
                    //         var _item = item;
                    //         this.newFriendArray.forEach((item2,index2) =>{
                    //             // 如果this.newFriendArray里有这个人了，则删除dom中的这个元素，这一块是处理重复添加的那些人，这个列表会显示多个这个人
                    //             if(_item.querySelector('.display_name').innerHTML === item2.querySelector('.display_name').innerHTML){
                    //                 _item.parentNode.removeChild(_item);
                    //                 _item = null;
                    //                 console.log('已删除一个重复的请求')
                    //             }
                    //         })
                    //         // 如果不是重复的请求,则添加进this.newFriendArray
                    //         if(_item){
                    //             this.newFriendArray.push(_item)
                    //         }
                    //     }
                    // })
                    // // 理论上不会走这里，但是一旦走了这里就进行下一次轮询吧
                    // if(!this.newFriendArray.length){
                    //     watchat = null;
                    //     watchat = new Wachat().init();
                    //     return;
                    // }
                    // // 验证这些新加好友是否来自一体机
                    // this.verfiyIsFromXiaoWei()
                }
                else{
                    return null;
                }
            }
            else{
                return null;
            }
        }
        else{
            return null;
        }
    }
    /**
     * 获取添加好友的按钮
     */
    getAddFriendButtn(){
        var addButton = document.querySelector('#mmpop_profile .web_wechat_tab_add');
        return addButton
    }
    /**
     * 
     */
    getToSendMsgButton(){
        var sendMsgButton = document.querySelector('#mmpop_profile .web_wechat_tab_launch-chat');
        return sendMsgButton;
    }


    /**
     * 验证是否有新好友
     */
    verifyIsHaveNewFriend(){
        // 微信已退出
        if(this.wxIsQuit()){
            // 如果微信不是登陆状态，则告诉主线程微信退出了
            ipcRenderer.send('wxQuit','微信退出啦');
            return;
        }
        setTimeout(() =>{
            // 输出轮询次数
            console.log(`轮询检测：${++loopTimes} 次，时间：${new Date().toString()}`);

            // 查看左边列表有没有申请加好友的
            var friendRecommendMsgElement = this.getFriendRecommendMsgElement();
            // 如果没有【添加好友】的信息 则执行下一次轮询
            if(!friendRecommendMsgElement){
                watchat = null;
                watchat = new Wachat().init();
            }
            else{
                try {
                    friendRecommendMsgElement.firstElementChild.click();
                } catch (error) {
                    console.error(`错误原因：item.firstElementChild=${friendRecommendMsgElement.firstElementChild}`)
                }
                this.preventUserDoAnyThing();
            }
        },POLL_DELAY)
        // console.log(document.querySelectorAll('#J_NavChatScrollBody > div > div'))
    }
    /**
     * 检测微信是否已经退出
     */
    wxIsQuit(){
		var login = document.querySelector('.login');
		return (login && window.getComputedStyle(login,null).display === 'block') ? true : false;
	}
}




window.onload = function(){
    bianlaLoginResult = JSON.parse(fs.readFileSync('bianlaMsg.json','utf-8'));
    console.log(bianlaLoginResult)
    console.log('window.onload')

    keepAlive = new KeepAlive({
        bianlaId:bianlaLoginResult.data.bianla_id,
        win:window,
        doc:document,
        startCallback(){

        },
        stopCallback(){

        }
    });
    keepAlive.start();
    watchat = new Wachat().init()
}