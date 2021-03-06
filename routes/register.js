/**
 * 注册Routes
 */

var jixiang = require('../models/base');
var crypto = require('crypto');
var config = require('../config');
var utils = require('../models/utils');

var index = function(req,res){
  if(req.method == 'GET'){
    res.render('./index/reg',
      {
        title : config.name
       ,user :  req.session.user
      });
  }else if(req.method == 'POST'){
    var cat = parseInt(req.query.cat,10) || 1;
    //普通用户注册时候需要验证密码是否相同
    if(cat ==1){
      if(req.body['repassword'] != req.body['password']){
        return res.json({flg:0,pwderror:1,msg:'密码不一致'});
      }      
    }
    //生成口令散列
    var md5 = crypto.createHash('md5');
    var password = md5.update(req.body.password).digest('base64');
    var userdata = {
       username : req.body.username
      ,password : password
      ,email : req.body.email
      ,cat : cat
      ,regdate : Date.now()
      ,logindate : Date.now()
    };
    if(cat === 3){
      userdata.rank = req.body.rank;
    }else{
      userdata.sex = req.body.sex;
    }
    if(cat === 2){
      userdata.realname = req.body.realname;
      userdata.school = req.body.school;
    }
    jixiang.getOne({
       '$or' : [
         { username : userdata.username }
        ,{ email : userdata.email }
       ]
    },'users',function(err,doc){
      if(doc){
        err = '用户名或者邮箱已经存在!';
      }
      if(err){
        return res.json({flg:0,msg:err});
      }
      jixiang.save(userdata,'users',function(err,doc){
        if(err){
          return res.json({flg:0,msg:err});
        }
        var msg ='注册成功',redirect = '/';
        if(cat === 1){
          req.session.user = doc[0];
        }else{
          msg = '增加成功';
          redirect = '/admin/user?cat='+cat
        }
        res.json({flg:1,msg:msg,redirect:redirect});
      });
      
    });
  }
}
exports.index = index;

exports.forgot = function(req,res){
  if(req.method == 'GET'){
    res.render('./index/forgot',
    {
        title : config.name
       ,user :  req.session.user
       ,template : 1
    });
  }else if(req.method == 'POST'){
     var email = req.body.email;
     jixiang.getOne({email:email},'users',function(err,doc){
        if(err || !doc)return res.json({flg:0,msg:'邮箱不存在！'});

        var md5 = crypto.createHash('md5');
        var date = new Date().getTime();
        var key = md5.update(''+date).digest('base64');
        jixiang.update({
          query:{
            _id :doc._id
          },
          modify:{
            '$set':{
               retrieve_key : key
              ,retrieve_time : date
            }
          }
        },'users',function(err){
           var html = '<p><a href="'+config.base+'setpass?key='+key+'&email='+email+'">请点击这里进行密码重置</a></p><p>请在24个小时内点击有效</p>';
           utils.email(email,'程序问答密码重置','请在24个小时内点击有效',html);
           return res.json({flg:2,cover:1,msg:'请在24个小时内前往邮箱收取重置密码的邮件，点击链接进行重置密码！'});
        });
     })
  }
}

exports.setpass = function(req,res){
  var key = req.query.key;
  var email = req.query.email;
  if(req.method == 'GET'){
    var setpass = '';
    jixiang.getOne({email:email,retrieve_key:key},'users',function(err,doc){
      if(err)console.log(err);
      if(!doc || !doc.retrieve_time || (doc.retrieve_time - new Date().getTime() > 3600*24*1000) ){
         setpass = '信息有误或者链接已经失效！请重新申请！';
      }
      render();
    })
    function render(){
      var renderData = {
        title : config.name + '密码重置'
       ,user :  req.session.user
       ,template : 2
       ,setpass : setpass
      }
      res.render('./index/forgot',renderData);
    }
  }else if(req.method == 'POST'){
    jixiang.getOne({email:email,retrieve_key:key},'users',function(err,doc){
      if(err)console.log(err);
      if(!doc || !doc.retrieve_time || (doc.retrieve_time - new Date().getTime() > 3600*24*1000)){
        return res.redirect('/setpass?key='+key+'&email='+email);
      }
      if(req.body['repassword'] != req.body['password']){
          return res.json({flg:0,pwderror:1,msg:'密码不一致'});
      } 
      var password = crypto.createHash('md5').update(req.body.password).digest('base64');
      jixiang.update({
        query : {
          _id : doc._id
        }
       ,modify : {
         '$set' : {
            password : password
           ,retrieve_key : null
           ,retrieve_time : null
         }
       }
      },'users',function(err){
         return res.json({flg:1,msg:'密码重置成功！',redirect:'/'});
      });
    });
 
  }
}