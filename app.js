const express = require('express');
const app = express();
/** 
 * public - имя папки где храниться статика
 */
app.use(express.static('public'));

/** 
 * задаём шаблонизатор
 */
app.set('view engine', 'pug');

/** 
 * Подключаем mysql модуль
 */
let mysql = require('mysql');

app.use(express.json());

const nodemailer = require('nodemailer');
/** 
 * настраиваем модуль
 */
let con = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '12345',
	database: 'market'
});

app.get('/', function (req, res) {
	let cat = new Promise(function (resolve, reject) {
		con.query(
			"select id,name, cost, image, category from (select id,name,cost,image,category, if(if(@curr_category != category, @curr_category := category, '') != '', @k := 0, @k := @k + 1) as ind   from goods, ( select @curr_category := '' ) v ) goods where ind < 3",
			function (error, result, fields) {
				if (error) return reject(error);
				resolve(result);
			}
		);
	});

	let catDescription = new Promise(function (resolve, reject) {
		con.query(
			"SELECT * FROM category",
			function (error, result, fields) {
				if (error) return reject(error);
				resolve(result);
			}
		);
	});

	Promise.all([cat, catDescription]).then(function (value) {
		res.render('index', {
			goods: JSON.parse(JSON.stringify(value[0])),
			cat: JSON.parse(JSON.stringify(value[1]))
		})
	});
});

app.get('/cat', function (req, res) {
	let catId = req.query.id;
	let cat = new Promise(function (resolve, reject) {
		con.query('SELECT * FROM category WHERE id=' + catId, function (error, result) {
			if (error) reject(error);
			resolve(result);
		});
	});

	let goods = new Promise(function (resolve, reject) {
		con.query('SELECT * FROM goods WHERE category=' + catId, function (error, result) {
			if (error) reject(error);
			resolve(result);
		});
	});

	Promise.all([cat, goods]).then(function (value) {
		res.render('cat', {
			cat: JSON.parse(JSON.stringify(value[0])),
			goods: JSON.parse(JSON.stringify(value[1]))
		});
	});
});

app.get('/goods', function (req, res) {
	con.query('SELECT * FROM goods WHERE id=' + req.query.id, function (error, result, fields) {
		if (error) throw error;
		res.render('goods', { goods: JSON.parse(JSON.stringify(result)) });
	});
});

app.get('/order', function (req, res) {
	res.render('order');
});

app.get('/login', function (req, res) {
	res.render('login');
});

app.get('/register', function (req, res) {
	res.render('register');
});

app.post('/get-category-list', function (req, res) {
	con.query('SELECT id, category FROM category', function (error, result, fields) {
		if (error) throw error;
		res.json(result);
	});
});

app.post('/get-goods-info', function (req, res) {
	if (req.body.key.length != 0) {
		con.query('SELECT id, name, cost FROM goods WHERE id IN (' + req.body.key.join(',') + ')', function (error, result, fields) {
			if (error) throw error;
			let goods = {};
			for (let i = 0; i < result.length; i++) {
				goods[result[i]['id']] = result[i];
			}
			res.json(goods);
		});
	} else {
		res.send('0');
	}
});

app.post('/finish-order', function (req, res) {
	console.log(req.body);
	if (req.body.key.length != 0) {
		let key = Object.keys(req.body.key);

		con.query('SELECT id, name, cost FROM goods WHERE id IN (' + key.join(',') + ')', function (error, result, fields) {
			if (error) throw error;
			sendMail(req.body, result).catch(console.error);
			res.send('1');
		});

	} else {
		res.send('0');
	}
});

async function sendMail(data, result) {
	let res = '<h2>Order in Shop</h2>';
	let total = 0;

	for (let i = 0; i < result.length; i++) {
		res += `<p>${result[i]['name']} - ${data.key[result[i]['id']]} - ${result[i]['cost'] * data.key[result[i]['id']]} uah </p>`;
		total += result[i]['cost'] * data.key[result[i]['id']];
	}

	console.log(res);
	res += '<hr>';
	res += `Total ${total} uah`;
	res += `<hr>Phone: ${data.phone}`;
	res += `<hr>Username: ${data.username}`;
	res += `<hr>Address: ${data.address}`;
	res += `<hr>email: ${data.email}`;

	let testAccount = await nodemailer.createTestAccount();

	let transporter = nodemailer.createTransport({
		host: "smtp.ethereal.email",
		port: 587,
		secure: false, // true for 465, false for other ports
		auth: {
			user: testAccount.user, // generated ethereal user
			pass: testAccount.pass // generated ethereal password
		}
	});

	let mailOptions = {
		from: '<rycoka6@mail.ru>',
		to: 'rycoka6@mail.ru, ' + data.email,
		subject: 'Shop order',
		text: 'Hello Wordl',
		html: res
	};

	let info = await transporter.sendMail(mailOptions);
	console.log("MessageSent: %s", info.messageId);
	console.log("PreviewSent: %s", nodemailer.getTestMessageUrl(info));
	return true;
}

app.listen(3000, () => console.log('Node express work on 3000'));