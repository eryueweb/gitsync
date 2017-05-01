const http = require('http');
const https = require('https');
const fs = require('fs');
const qs = require('querystring');
const url = require('url');
const base = require('base64-min');
const crypto = require('crypto');
const sj = require('shelljs');

const config = require('./config');
const ssl = config.SSL;
const key = ssl.support?fs.readFileSync(ssl.key):'';
const cert = ssl.support?fs.readFileSync(ssl.cert):'';
const server =  ssl.support
			  ? https.createServer({key,cert},App)
			  : http.createServer(App);

server
.listen(config.PORT)
.on('error',err=>{
	if (err) {
		if (err.code=='EADDRINUSE') {
			console.log(config.PORT+' is inuse');
		}else{
			console.log(err);
		};
	}
})
.on('listening',()=>{
	console.log('gitsync is ready on port : '+config.PORT);
});

function App(req,res){

	if (req.method != 'GET') {
		res.end('GET method excepted !');
		return false;
	};

	const _end = res.end.bind(res);
	res.end = function(code,data){
		let _code = code;
		let _data = data;
		if (!data) {
			_code = 200;
			_data = code;
		};
		res.statusCode = _code;
		_end(_data);
		return false;
	}
	const ser = {
		req,
		res
	}
	SimpleRouter.call(ser,{
		'/gitsync':()=>{
			const query=parseUrl(req.url);
			validateQuery(query,(err)=>{
				if (err) {
					console.log(err);
					res.end(err.code,err.message);
				}else{
					validateSignature(query.signature,(err,baseQuery)=>{
						if (err) {
							console.log(err);
							res.end(err.code,err.message);
						}else{
							if (baseQuery.git&&baseQuery.user) {
								if (baseQuery.git==query.git&&baseQuery.user==query.user) {
									
									sj.cd(config.LOC_REPLPATH);
									sj.exec(query.git,{async:true},(code,out,err)=>{
										if (err) {
											res.end(500,err);
										}else{
											res.write(`
												<p>exec <b>${query.git}</b> success !</p>
												<p>${out.replace(/\n/g,'<br>')}</p>
												<p>${new Date().toLocaleString()}</p>
												<p>${code}</p>
											`);
											res.end();
										};
									});
								}else{
									res.end(500,'invalid signature or query');
								};
							}else{
								res.end(500,'invalid signature');
							};
						};
					});
				};
			});
		},
		'*':'this is for 404.html'
	});
	
}

function parseUrl(_url){
	return qs.parse(url.parse(_url).query);
}

function validateQuery(query,cb){
	let access = {
		query:config.QUERYS.every(q=>query[q]),
		user:~config.USERS.indexOf(query.user)
	}
	if (access.query) {
		if (access.user) {
			cb(null,query);
		}else{
			cb({
				code:500,
				message:'invalid user'
			},null);
		};
	}else{
		cb({
			code:400,
			message:'invalid query params'
		},null);
	};
}

function validateSignature(signature,cb){
	let str = deCipher(signature);
	let signatureInfo = qs.parse(deCipher(str));
	
	if (signatureInfo.expire<=Date.now()) {
		cb({
			code:500,
			message:'signature expired'
		},null);
	}else{
		let baseQuery = {
			git:signatureInfo.git,
			user:signatureInfo.user
		};
		console.log(signatureInfo)
		console.log(baseQuery);
		if (!baseQuery.git||!baseQuery.user) {
			cb({
				code:400,
				message:'err in invalid signature'
			},null);
		}else{
			cb(null,baseQuery);
		};
	};
}

function getArgtype(arg){
	return Object.prototype.toString.call(arg).toLowerCase().match(/\s(\w+)/)[1];
}

function toRegExp(str){
	str=getArgtype(str)=='string'?str:JSON.stringify(str);
	return str=='*'?(/.+/gi):new RegExp(str.replace(/[\$\?\.\/\-\*\\]/g,'\\$&'),'gi');
}

function toFunction(exceptFunction,ser){
	getArgtype(exceptFunction)=='function'
	?exceptFunction()
	:ser.res.end(JSON.stringify(exceptFunction));
}

function SimpleRouter(routesMap){
	let argType = getArgtype(routesMap);
	if (argType!='object') throw `routesMap:[${argType}] unexcepted !`;
	let realPath = url.parse(this.req.url).pathname;
	for(let pathname in routesMap){
		let pathnameReg = getArgtype(pathname)=='regexp'?pathname:toRegExp(pathname);
		if (pathnameReg.test(realPath)) {
			toFunction(routesMap[pathname],this);
			break;
		};
	}
}

function deCipher(str){
	try{
		let decipher = crypto.createDecipher('aes-256-cbc', config.BASE_MIN_KEY);
		let dec = decipher.update(str, 'hex', 'utf8');
		return dec += decipher.final('utf8');
	}catch(e){
		console.log(e);
	}
}
