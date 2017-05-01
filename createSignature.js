const base = require('base64-min');
const crypto = require('crypto');
const open = require('open');
const config = require('./config');

function rand(s,e){
	return Math.floor(Math.random()*e)+s;
};
function enCipher(str){
	let cipher = crypto.createCipher('aes-256-cbc', config.BASE_MIN_KEY);
	let crypted = cipher.update(str, 'utf8', 'hex');
	return crypted += cipher.final('hex');
};

let gitCmd = ['git log','git status','git branch','git push origin master'];
let git = gitCmd[rand(0,gitCmd.length)];
let user = config.USERS[rand(0,config.USERS.length)];
let qs = `git=${git}&user=${user}`;
let signature = enCipher(enCipher(`${qs}&expire=${Date.now()+1000*60}`));

console.log(qs)
console.log(signature);

open(`http://localhost:${config.PORT}/gitsync?${qs}&signature=${signature}`);