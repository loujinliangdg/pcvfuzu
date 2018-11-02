module.exports = {
    /**
     * 返回sessionStorage中已添加的好友列表
     */
    getFriendList(){
        return JSON.parse(sessionStorage.getItem('friendList')) || []
    },
    /**
     * 
     * @param {string} friendName 检查 sessionStorage列表中是否有friendName
     */
    hasFriend(friendName,headImage){
        var friendList = this.getFriendList();
        if(!friendList.length){
            return false;
        }
        else{
            for(let i=0; i<friendList.length;i++){
                if(friendList[i].friendName === friendName && friendList[i].headImage === headImage){
                    return true;
                }
            }
            return false;
        }
    },
    /**
     * 
     * @param {string} friendName 将friendName存入本地 
     */
    addFriend(friendName){
        var friendList = this.getFriendList();
        friendList.push(friendName);
        sessionStorage.setItem('friendList',JSON.stringify(friendList))
        return true;
    }
}