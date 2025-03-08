const express = require("express");
const app = express();
const axios = require('axios');
const packageJson = require('./package.json');
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

async function getLatestGitHubVersion() {
    try {
        const response = await axios.get(`https://api.github.com/repos/kolle86/node-radio/releases/latest`);
        return response.data.tag_name.replace(/^v/, '');
    } catch (error) {
        console.error('Fehler beim Abrufen der GitHub-Version:', error.message);
        return null;
    }
}

app.get('/', async(req, res) => {

    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        const isUpToDate = packageJson.version === await getLatestGitHubVersion();
        const version = ({
            appVersion: packageJson.version,
            isUpToDate,
        });
        data = null;
        res.render('index', {data, version});
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

app.post('/', async (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    
    if (isLoggedIn) {
        const isUpToDate = packageJson.version === await getLatestGitHubVersion();
        const version = ({
            appVersion: packageJson.version,
            isUpToDate,
        });
        search = req.body.searchterm;
        if(search != "" && search != null){
            let filter = {
                by: 'name',         // search in tag
                searchterm: search // term in tag
            }
            RadioBrowser.getStations(filter)
                .then(data => res.render('index', { data,  search, version}))
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

app.get("/cover", async (req, res) => {
    const { title } = req.query;
    if (!title) {
        return res.status(400).json({ error: "Bitte einen Songtitel angeben." });
    }
    
    let searchTerm = title;
    const parts = title.split(" - ").map(str => str.trim());
    if (parts.length === 2) {
        searchTerm = `${parts[0]} ${parts[1]}`;
    }
    
    try {
        const response = await axios.get("https://itunes.apple.com/search", {
            params: {
                term: searchTerm,
                media: "music",
                entity: "musicTrack",
                entity: "album",
                limit: 1
            }
        });
        
        if (response.data.resultCount > 0) {
            const coverUrl = response.data.results[0].artworkUrl100.replace("100x100bb", "500x500bb");
            res.json({ searchTerm, coverUrl });
        } else {
            res.json({ searchTerm, coverUrl: null }); // Leeres Ergebnis statt 404
        }
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Abrufen des Covers." });
    }
});

app.listen(3000, '0.0.0.0');
