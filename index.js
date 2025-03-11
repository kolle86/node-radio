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
const port = 3010;
let album_cover_cache = { query: "", response: null };

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use("/audiomotion", express.static(path.join(__dirname, "node_modules/audiomotion-analyzer/dist")));
app.use("/bootstrap", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));
app.use("/icons", express.static(path.join(__dirname, "node_modules/bootstrap-icons/font")));

app.use(bodyParser.json());
app.use(cors());

const sessionSecret = randomBytes(32).toString("hex");
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Middleware to check if the user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/login', (req, res) => {
    res.render('login');
});

app.use((req, res, next) => {
    if (!fs.existsSync(favsFile)) {
        fs.writeFileSync(favsFile, JSON.stringify({ stations: [] }, null, 2));
        console.log("favourites.json wurde erstellt.");
    }
    next();
});

/**
 * Fetches the latest version of the application from GitHub.
 * @returns {Promise<string|null>} The latest version tag or null if an error occurs.
 */
async function getLatestGitHubVersion() {
    try {
        const response = await axios.get(`https://api.github.com/repos/kolle86/node-radio/releases/latest`);
        return response.data.tag_name.replace(/^v/, '');
    } catch (error) {
        console.error('Fehler beim Abrufen der GitHub-Version:', error.message);
        return null;
    }
}

/**
 * Renders the home page or login page based on authentication status.
 * @route GET /
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/', isLoggedIn, async (req, res) => {
    const isUpToDate = packageJson.version === await getLatestGitHubVersion();
    const version = ({
        appVersion: packageJson.version,
        isUpToDate,
    });
    data = null;
    res.render('index', { data, version });
})

/**
 * Handles user login by validating the password.
 * @route POST /login
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/login', async (req, res) => {
    var isValidUser = false;

    if (req.body.password == password) {
        req.session.isLoggedIn = true;
        res.redirect("/");
    } else {
        var login_error = true;
        res.render('login', { login_error });
    }

});

/**
 * Searches for radio stations and renders the index page with results.
 * @route POST /
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/', isLoggedIn, async (req, res) => {
    const isUpToDate = packageJson.version === await getLatestGitHubVersion();
    const version = {
        appVersion: packageJson.version,
        isUpToDate,
    };
    const search = req.body.searchterm;
    if (search != "" && search != null) {
        const filter = {
            by: 'name',         // search in tag
            searchterm: search // term in tag
        };
        RadioBrowser.getStations(filter)
            .then(data => res.render('index', { data, search, version }))
            .catch(error => console.error(error));
    } else {
        res.redirect("/");
    }
});

/**
 * Saves favorite radio stations to a file.
 * @route POST /setfavs
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post('/setfavs', isLoggedIn, (req, res) => {
    try {
        fs.writeFileSync(favsFile, JSON.stringify(req.body));
        res.send("ok");
    } catch (error) {
        console.error('Error writing favourites:', error);
        res.status(500).send('Error saving favorites');
    }
});

/**
 * Retrieves favorite radio stations from a file.
 * @route GET /getfavs
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/getfavs', isLoggedIn, (req, res) => {
    try {
        res.send(JSON.parse(fs.readFileSync(favsFile)));
    } catch (error) {
        console.error('Error reading favourites:', error);
        res.status(500).send('Error reading favorites');
    }
});

/**
 * Logs out the user by destroying the session.
 * @route GET /logout
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    });
});

/**
 * Fetches album cover art for a given song title.
 * @route GET /cover
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.get("/cover", isLoggedIn, async (req, res) => {
    const { title } = req.query;
    if (!title) {
        return res.status(400).json({ error: "Bitte einen Songtitel angeben." });
    }

    if (album_cover_cache.query === title && album_cover_cache.response) {
        return res.json(album_cover_cache.response);
    }

    //let searchTerm = title.replace(/\(.*?\)/g, "").trim();
    let searchTerm = title.replace(/[\(\[][^)\]]*[\)\]]/g, "").trim();
    const parts = searchTerm.split(" - ").map(str => str.trim());
    if (parts.length >= 2) {
        let artist = parts.slice(0, -1).join(" - ");
        let song = parts[parts.length - 1];
        artist = artist.replace(/\s*(feat\.?|x|&|vs\.)\s+/gi, ", ").replace(/,/g, "").trim(); //all artists
        //artist = artist.split(/ x | & | feat\.?/i)[0].trim(); //only first artist
        searchTerm = `${artist} ${song}`;
    }
    try {
        const response = await axios.get("https://itunes.apple.com/search", {
            params: {
                term: searchTerm,
                media: "music",
                //entity: "musicTrack",
                entity: "album",
                //entity: "song",
                limit: 1
            }
        });

        let result;
        if (response.data.resultCount > 0) {
            const coverUrl = response.data.results[0].artworkUrl100.replace("100x100bb", "500x500bb");
            result = { searchTerm, coverUrl };
        } else {
            result = { searchTerm, coverUrl: null }; 
        }

        album_cover_cache = { query: title, response: result };
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Abrufen des Covers." });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
