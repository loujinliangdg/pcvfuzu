// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process

const axios = require('./utils/axios');
const qs = require('querystring');
//在渲染器进程 (网页) 中。
const {ipcRenderer} = require('electron')
const API_HOST = require('./API_HOST').api_host

/**
 * 微信登陆二维码管理
 */
class LoginQrCode{
    constructor(){
        this.qrCodeElement = null;
        this.qrCode = document.createElement('img');
        this.qrCode.className = 'wx-login-qrcode';
        this.qrCode.title = '点击刷新二维码'
    }
    addQrCode(src){
        if(!this.qrCodeElement){
            this.qrCode.src = src;
            document.body.appendChild(this.qrCode);
            this.qrCodeElement = document.querySelector('.wx-login-qrcode');
        }
        else{
            console.log('已存在微信二维码img,转去更新二维码')
            this.updateQrCode(src);
        }
    }
    updateQrCode(src){
        this.qrCodeElement.src = src;
    }
}

class DoWeiXin {
    
    constructor(){
        this.uuid = null
    }

    beforeLogin(tip=1){
        /**
         * 获取uuid
         */
        axios.post(`https://login.weixin.qq.com/jslogin`,qs.stringify({
            appid: 'wx782c26e4c19acffb' ,
            fun: 'new', 
            lang: 'zh_CN' ,
            _: Date.now(),
        }))
        .then((result) =>{
            let match = result.match(/uuid\s?=\s?["|']([^"|']+)["|']/);
            let uuid = match && match[1];
            this.uuid = uuid;
            /**
             * 获取登录微信二维码
             */
            axios.post(`https://login.weixin.qq.com/qrcode/${uuid}`,qs.stringify({
                't': 'webwx',
                '_': Date.now(),
            }),{responseType: 'blob'})
            .then((result) =>{
                blobToDataURL(result,(result) =>{
                    loginQrCode.addQrCode(result);//result = base64字符串
                    this.login();
                })
            })
        })
        .catch((error) =>{
            console.log(error);
        })
    }
    login(tip=1){
        /**
         *  获取用户手机扫描状态
         *  408 登陆超时
         *  201 扫描成功
         *  200 确认登录
         */
        axios.get(`https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login`,{params:{
            tip:tip,
            uuid:this.uuid,
            _:Date.now(),
        }})
        .then((result) =>{
            var match = result.match(/code=(\d+)/);
            if(match){
                const code = parseInt(match[1]);
                console.log(code);
                if(code === 201){
                    setTimeout(() => this.login(0))
                }
                else if(code == 200){
                    var match = result.match(/redirect_uri="([^"]+)"/);
                    console.log('微信登陆成功')

                    if(match){
                        ipcRenderer.send('to-login-wechat', match[1]);
                    }
                    else{
                        console.log('纳尼？')
                    }
                }
                else{
                    setTimeout(() => this.login())
                }
            }
        })
    }
}


function blobToDataURL(blob, callback) {
    var a = new FileReader();
    a.onload = function (e) { callback(e.target.result); }
    a.readAsDataURL(blob);
}
function bialaLoginErrorTsShow(text){
    var ts = document.querySelector('.error-ts')
    if(text){
        ts.innerHTML = text;
    }
    ts.style.display = 'block';
}
function bianlaLoginErrorTsHide(){
    var ts = document.querySelector('.error-ts')
    ts.style.display = 'none';
}

const loginQrCode = new LoginQrCode();

document.forms[0].onsubmit = function(event){
    event.preventDefault();
    var phoneNumber = document.querySelector('.phoneNumber').value;
    var password = document.querySelector('.password').value;
    axios.get(`${API_HOST}/api/vhelper/loginByPCWeChat`,{params:{phoneNumber:phoneNumber,password:password}}).then((result) =>{
        if(result.code == 1){
            console.log(result)
            ipcRenderer.send('bianla-login-complete', result);
            new DoWeiXin().beforeLogin();
            bianlaLoginErrorTsHide();
        }
        else{
            bialaLoginErrorTsShow(result.alertMsg);
        }
    })
    .catch((error) =>{
        bialaLoginErrorTsShow(error.toString());
    })
}

ipcRenderer.on('update-wxQrCode',(event,arg)=> {
    console.log('update-wxQrCode：更新维新二维码')
    new DoWeiXin().beforeLogin();
})