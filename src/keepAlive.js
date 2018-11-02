
const axios = require('./utils/axios');
const API_HOST = require('./API_HOST').api_host



class KeepAlive{
	constructor(options){
		var options = typeof options === 'object' ? options : {};
		this.during = 10000 || options.during;
		this.timer = null;
		this.isRunning = false;
		this.win = options.win || null;
		this.doc = options.doc || null;
		this.bianlaId = options.bianlaId || null;
		this.stopCallback = options.stopCallback || function stopCallback(){}
		this.startCallback = options.startCallback || function startCallback(){}
	}
	start(){
		if(this.isRunning) {
			return;
		}
		
		this.request();
		this.startCallback();

		this.timer = setInterval(() =>{
			this.request();
		},this.during);
	}
	stop(){
		clearInterval(this.timer);
		this.isRunning = false;
		this.stopCallback();  
	}
	request(){
		this.isRunning = true;
		if(this.wxIsQuit()){
			this.stop();
		}
		else{
			axios.get(`${API_HOST}/api/heartbeat/keepAlive/${this.bianlaId}`).then((result) =>{
				console.log(`心跳检测：${result.code}`)
			})
		}
	}
	/**
     * 检测微信是否已经退出
     */
    wxIsQuit(){
		var login = this.doc.querySelector('.login');
		return (login && this.win.getComputedStyle(login,null).display === 'block') ? true : false;
	}
}

module.exports = KeepAlive