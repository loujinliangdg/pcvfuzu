// Modules to control application life and create native browser window
const electron = require('electron')
const axios = require('./utils/axios')
const qs = require('querystring')
const {
  app, 
  BrowserWindow,
  ipcMain,
  session,
  dialog
} = electron

const path = require('path');

const fs = require("fs");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let wxWindow;
let webwxsendmsgPlayload = null; //给用户发分享形式报告需要的参数对象
/**
 * 发现微信退出了让他来重新登陆微信
 */
ipcMain.on('wxQuit',(event,arg) =>{
  console.log('wxQuit');
  mainWindow.show();
  mainWindow.webContents.send('update-wxQrCode')
  setTimeout(() =>{
    wxWindow.destroy();
  })
})

/**
 * 微信页面获取 发消息需要的参数事件
 */
ipcMain.on('get-webwxsendmsgPlayload',(event,arg) =>{
  console.log('get-webwxsendmsgPlayload')
  event.returnValue = webwxsendmsgPlayload
})


/**
 * 变啦登陆完成
 */
ipcMain.on('bianla-login-complete', (event, arg) => {
  var bianlaLoginResult = arg;
  /**
   * 微信二维码扫描成功，该去跳至微信web版
   */
  ipcMain.on('to-login-wechat', (event, arg) => {
    console.log('to login wechat')
    // 将变啦登陆成功后的信息存入本地
    fs.writeFileSync('bianlaMsg.json', JSON.stringify(bianlaLoginResult));


    mainWindow.hide();
    createWx(arg,bianlaLoginResult);
    

    const {session} = require('electron')
  
    // Modify the user agent for all requests to the following urls.
    const filter = {
      urls: []
    }
    
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      // 发消息的接口
      if(/webwxsendmsg/.test(details.url)){
        // console.log(details);
        // console.log(details.uploadData[0])
        // console.log(Object.prototype.toString.call(details.uploadData[0]))
        // console.log(Object.prototype.toString.call(details.uploadData[0].bytes))
        // console.log(details.uploadData[0].bytes.toString())
        if(!webwxsendmsgPlayload){
          webwxsendmsgPlayload = JSON.parse(details.uploadData[0].bytes.toString())
          webwxsendmsgPlayload.headers = details.headers
        }
      }
      callback({cancel: false, requestHeaders: details.requestHeaders})
    })
  })
})

function createWindow () {
  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
  // Create the browser window.
  mainWindow = new BrowserWindow({width:1000 , height:800})
  mainWindow.setTitle('变啦小v');
  mainWindow.on('page-title-updated',(event) => event.preventDefault())

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`)

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}
// 创建微信窗口
function createWx(redirect,bianlaLoginResult){
  const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
  // Create the browser window.
  wxWindow = new BrowserWindow({width:1000 , height:800,minimizable:false,webPreferences: {
    preload: path.join(__dirname, 'wechat.js')
  }})
  wxWindow.setTitle('变啦小v');
  wxWindow.on('page-title-updated',(event) => event.preventDefault())
  // and load the index.html of the app.
  wxWindow.loadURL(redirect)
  // Open the DevTools.
  // wxWindow.webContents.openDevTools()
  // 如果在微信界面用户点击关闭按钮，则提醒他关闭后不再接单
  wxWindow.on('close',function(){
    const options = {
      type: 'warning',
      title: '警告',
      message: "关闭后无法接单，确定关闭吗？",
      buttons: ['否', '是']
    }
    dialog.showMessageBox(options, function (index) {
      // event.sender.send('information-dialog-selection', index)
      if(index === 1){
        wxWindow.destroy();
        mainWindow.destroy();
        app.quit()
      }
    })
  })
  // Emitted when the window is closed.
  wxWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    wxWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
  // if(wxWindow === null){
  //   createWx();
  // }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
