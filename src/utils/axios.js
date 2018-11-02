const axios = require('./npm_modules/axios');
axios.interceptors.response.use(function (response) {
    // console.log(response)
    return response.data;
},function(err){
    // Toast("网络错误")
    return Promise.reject(err);
});
module.exports = axios;