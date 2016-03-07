// Create Web Server
var express = require('express');
var app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
    next();
});
app.listen(3030, function(){
  console.log('Chat Server listening on port:4040');
});
//end create webserver

var server = require('socket.io')(3031);
var io = server;
var connectedUsers = {users: []};
var applicationKey = {applicationkeys: [
		{id : 'c4ca4238a0b923820dcc509a6f75849b', application: 'payorlink', prefix: '1001'},
		{id : 'c81e728d9d4c2f636f067f89cc14862c', application: 'ilink', prefix: '1002'}
	]}

var connection  = require('express-myconnection'); 
var mysql = require('mysql');

var pool = mysql.createPool({
	connectionLimit : 500, //important
	host     : 'localhost',
	user     : 'root',
	password : 'usbw',
	database : 'chat'
});

var getPrefix = function(application){
	var prefix;
	for(var i = 0; i < applicationKey.applicationkeys.length; i++){
		if(applicationKey.applicationkeys[i].id == application){
			prefix = applicationKey.applicationkeys[i].prefix;
			break;
		}
	}
	return prefix;
}
var getApplication = function(application){
	var app;
	for(var i = 0; i < applicationKey.applicationkeys.length; i++){
		if(applicationKey.applicationkeys[i].id == application){
			app = applicationKey.applicationkeys[i].application;
			break;
		}
	}
	return app;
}
var checkIfExisting = function(userid,username,application){
	var prefix = getPrefix(application);
	var app = getApplication(application);
	pool.getConnection(function(err, connection){
		if(err){
			console.log(err);
			return false;
		}else{
			var selectUser = 'CALL getUser("' + prefix + userid + '","'+ app +'")';
			connection.query(selectUser, function(err, rows){
				if(!err){
					if(JSON.stringify(rows[0]) != '[]'){
						return true;
					}else{
						var insertUser = 'CALL addUser("'+ prefix + userid +'","' + username + '","'+ app +'" )';
						connection.query(insertUser, function(err, rows){
							if(!err){
								return true;
							}else{
								console.log(err);
								return false;
							}
						});
					}
				}else{
					console.log(err);
					return false;
				}
			});
		}
	});
}
var sendTo = function(recipientId, senderId, message, div){
	var counter = 0;
	for(var j = 0; j < connectedUsers.users.length; j++){
		if(connectedUsers.users[j].userid == senderId){
			counter++;
		}if(connectedUsers.users[j].userid == recipientId){
			counter++;
		}if(counter == 2){	
			break;
		}

	}
	if(counter == 2){
		var sendername;
		var recipientname;
		var socket;
		for(var y = 0; y < connectedUsers.users.length; y++){
			if(connectedUsers.users[y].userid == recipientId){
				recipientname = connectedUsers.users[y].username;
				socket = connectedUsers.users[y].socket;
			}if(connectedUsers.users[y].userid == senderId){
				sendername = connectedUsers.users[y].username;
			}
			if(recipientname != null && sendername != null){
				break;
			}
		}
		data = {
			message: message,
			recipientname: recipientname,
			recipientID: recipientId,
			senderID: senderId,
			sendername: sendername,
			div: div
		}
		io.to(socket).emit('private message', data);
	}else{
		// insert to database	
	}
};

var getCurrentUser = function(socket){
	var username;
	for(var i = 0; i < connectedUsers.users.length; i++){
		if(socket == connectedUsers.users[i].socket){
			username = connectedUsers.users[i].username;
			break;
		}
	}
	return username;
}
var getCurrentUserID = function(socket){
	var id;
	for(var i = 0; i < connectedUsers.users.length; i++){
		if(socket == connectedUsers.users[i].socket){
			id = connectedUsers.users[i].userid;
			break;
		}
	}
	return id;
}
var getUserByID = function(id){
	var id;
	for(var i = 0; i < connectedUsers.users.length; i++){
		if(id == connectedUsers.users[i].userid){
			id = connectedUsers.users[i].username;
			break;
		}
	}
	return id;
}


io.on('connection', function(socket){
	var socket_id = socket.id;
	socket.on('connected', function(msg){
		var counter = 0;
		for(var i = 0; i < connectedUsers.users.length; i++){
			if(connectedUsers.users[i].userid == msg.userid){
				counter++;
				break;
			}
		}
		if(counter == 0){
			connectedUsers.users.push({
				socket: socket_id, 
				userid : msg.userid, 
				username: msg.username, 
				applicationkey: msg.applicationkey,
				imagepath: msg.imagepath,
				position: msg.position

			});
		}
		checkIfExisting(msg.userid,msg.username,msg.applicationkey);
	});
  	socket.on('private message', function(msg){
  		var recipient_appkey;
  		var sender_appkey;

  		var valid_application_key = 0;
  		for(var i = 0; i < applicationKey.applicationkeys.length; i++){
  			if(applicationKey.applicationkeys[i].id == msg.recipient_applicationkey){
  				recipient_appkey = applicationKey.applicationkeys[i].application;
  				valid_application_key++;
  			}if(applicationKey.applicationkeys[i].id == msg.applicationkey){
  				sender_appkey = applicationKey.applicationkeys[i].application;
  				valid_application_key++;
  			}if(sender_appkey != null && sender_appkey != '' && recipient_appkey != null && recipient_appkey != '' ){
  				break;
  			}
  		}

  		if(valid_application_key == 2){
  			sendTo(msg.recipient, msg.sender, msg.message, msg.div);
  		}else{
  			console.log('application key is invalid');
  		}
  		
  	});
  	socket.on('get online', function(msg){
  		var returnvalue = {users: []};
		for(var i = 0; i < connectedUsers.users.length; i++){
			if(connectedUsers.users[i].applicationkey == msg.applicationkey && connectedUsers.users[i].socket != socket_id){
				returnvalue.users.push({
					userid : connectedUsers.users[i].userid, 
					username: connectedUsers.users[i].username, 
					imagepath: connectedUsers.users[i].imagepath,
					position: connectedUsers.users[i].position
				});
			}
		}
		io.to(socket_id).emit('get online', returnvalue);
  	});

  	socket.on('disconnect', function(){
		for(var i = 0; i < connectedUsers.users.length; i++){
			if(connectedUsers.users[i].socket == socket_id){
				connectedUsers.users.splice(i,1);
			}
		}
	});
	socket.on('typing',function(msg){
		var div = 'typing'+getCurrentUserID(socket_id);
		var data = {
			sender: getCurrentUser(socket_id),
			senderid: getCurrentUserID(socket_id),
			recipientID: msg.recipientID,
			div: div
		};
		for(var i = 0; i < connectedUsers.users.length; i++){
			if(connectedUsers.users[i].userid == msg.recipientID ){
				io.to(connectedUsers.users[i].socket).emit('typing', data);
				break;
			}
		}
			
	});
	socket.on('done typing', function(msg){
		var div = 'typing'+getCurrentUserID(socket_id);
		var data = {
			sender: getCurrentUser(socket_id),
			senderid: getCurrentUserID(socket_id),
			recipientID: msg.recipientID,
			div: div
		};
		for(var i = 0; i < connectedUsers.users.length; i++){
			if(connectedUsers.users[i].userid == msg.recipientID ){
				io.to(connectedUsers.users[i].socket).emit('done typing', data);
				break;
			}
		}
	});
});

