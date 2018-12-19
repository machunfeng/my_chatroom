const http = require('http');
const socket = require('socket.io');
const fs = require('fs');
const mysql = require('mysql');
const auth = require('./libs/auths.js');

// database
let db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '2265698',
  database: '20181215'
});

// http
let httpServer = http.createServer((req, res) => {
  fs.readFile(`./${req.url}`, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.write('Sorry, not found!');
    } else {
      res.write(data);
    }
    res.end();
  });
});
httpServer.listen(8080);

// webSocket
let wsServer = socket.listen(httpServer);
let aSock = [];
wsServer.on('connection', sock => {
  let cur_username = '';
  let cur_userID = 0;
  aSock.push(sock);
  // register
  sock.on('reg', (user, pass) => {
    // 检验数据是否规范
    if (!auth.username.test(user)) {
      sock.emit('reg_auth', 1, '用户名不符合规范')
    } else if (!auth.password.test(pass)) {
      sock.emit('reg_auth', 1, '密码不符合规范')
    } else {
      // 检查用户是否存在
      db.query(`select ID from user_table where username = '${user}'`, (err, data) => {
        if (err) {
          sock.emit('reg_auth', 1, '数据库出错')
        } else if (data.length > 0) {
          sock.emit('reg_auth', 1, '用户已存在')
        } else {
          // 向数据库插入注册数据
          db.query(`insert into user_table (username, password, online) values ('${user}', '${pass}', 0)`, (err) => {
            if (err) {
              sock.emit('reg_auth', 1, '数据库有错误')
            } else {
              sock.emit('reg_auth', 0, '注册成功')
            }
          })
        }
      })
    }


  });
  // login
  sock.on('login', (user, pass) => {
    // 检验数据是否规范
    if (!auth.username.test(user)) {
      sock.emit('login_auth', 1, '用户名不符合规范')
    } else if (!auth.password.test(pass)) {
      sock.emit('login_auth', 1, '密码不符合规范')
    } else {
      // 检查用户是否存在
      db.query(`SELECT ID,password FROM user_table WHERE username='${user}'`, (err, data) => {
        if (err) {
          sock.emit('login_auth', 1, '数据库出错')
        } else if (data.length == 0) {
          sock.emit('login_auth', 1, '此用户不存在')
        } else if (data[0].password != pass) {
          sock.emit('login_auth', 1, '用户或密码错误')
        } else {
          // 改变在线状态
          db.query(`update user_table set online=1 where ID='${data[0].ID}'`, err => {
            if (err) {
              sock.emit('login_auth', 1, '数据库出错a')
            } else {
              sock.emit('login_auth', 0, '登陆成功');
              cur_username=user;
              cur_userID=data[0].ID;
            }
          })
        }
      })
    }
  });
  // send
  sock.on('msg', text => {
    if (!text) {
      sock.emit('msg_ret', 1, '不能为空')
    }else {
      aSock.forEach(item => {
        if(item==sock)return;
        item.emit('msg', cur_username, text);
      });
      sock.emit('msg_ret', 0, '发送成功')
    }
  })
  // off line
  sock.on('disconnect', () => {
    db.query(`update user_table set online=0 where ID='${cur_userID}'`, err => {
      if (err) {
        console.log('数据库有错')
      }
      cur_username='';
      cur_userID=0;
    })
  })
});