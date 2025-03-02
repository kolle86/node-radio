const express = require("express");
const app = express();
const RadioBrowser = require('radio-browser')
var bodyParser = require('body-parser')
const fs = require('fs');
const favsFile = './data/favourites.json';
var cors = require('cors')
const session = require('express-session');
const path = require("path");
const { randomBytes } = require("node:crypto");

require('dotenv').config();

const password = process.env.PASSWORD;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use("/audiomotion", express.static(path.join(__dirname, "node_modules/audiomotion-analyzer/dist")));
app.use("/bootstrap", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));
app.use("/icons", express.static(path.join(__dirname, "node_modules/bootstrap-icons/font")));

app.use(bodyParser.json());
app.use(cors())

const sessionSecret = randomBytes(32).toString("hex");
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 7*24*60*60*1000 }
}));

app.use((req, res, next) => {
    if (!fs.existsSync(favsFile)) {
        fs.writeFileSync(favsFile, JSON.stringify({ stations: [] }, null, 2));
        console.log("favourites.json wurde erstellt.");
    }
    next();
});

app.get('/', (req, res) => {

    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        data = null;
        res.render('index', {data});
    } else {
        if(password === undefined){
            res.send("No password set. Set password via environment (-e PASSWORD)")
        }else{
            res.render('login');
        }
    }
})

app.post('/login', async (req, res) => {
    var isValidUser = false;

    if(req.body.password == password){
      req.session.isLoggedIn = true;
      res.redirect("/"); 
    }else {
      var login_error = true;
      res.render('login', {login_error});
    }
      
});

app.post('/', (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        search = req.body.searchterm;
        if(search != "" && search != null){
            let filter = {
                by: 'name',         // search in tag
                searchterm: search // term in tag
            }
            RadioBrowser.getStations(filter)
                .then(data => res.render('index', { data,  search}))
                .catch(error => console.error(error))
        }else{
            res.redirect("/");
        }    
    } else {
        res.render('login');
    }

});

app.post('/setfavs', (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        try {
            fs.writeFileSync(favsFile, JSON.stringify(req.body))        
          } catch (error) {
            console.error('Error writing favourites:', error);
        }
        res.send("ok")
    } else {
        res.send('unauthorized');
    }

});

app.get('/getfavs', (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        try {
            res.send(JSON.parse(fs.readFileSync(favsFile)));
          } catch (error) {
            console.error('Error reading favourites:', error);
        }
    } else {
        res.send('unauthorized');
    }

});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    });
});

app.listen(3000, '0.0.0.0');
