var express = require("express");
var mongoose = require('mongoose');
var FeedParser = require('feedparser');
var http = require('http');

var app = express();
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(express.static('public')); // serve static content from app dir

// MongoDB setup

mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;

var postSchema = mongoose.Schema({
	feed: String,
	title: String,
	link: String,
	description: String
});

var PostModel = mongoose.model('Post', postSchema);
	
db.on('error', function(){
	console.log('mongodb error');
});
db.once('open', function callback () {
	console.log('mongodb connection opened');
});	

// Feed parsing
var fetchAndParseFeedUrl = function (url, success, error) {
	var feedMeta;
	var items = [];

	http.get(url, function(res) {
		res.pipe(new FeedParser({}))
				.on('error', error)
				.on('meta', function(meta){
					feedMeta = meta;
				})
				.on('readable', function(){
					var stream = this, item;
					
					while (item = stream.read()) {
						var postModel = new PostModel({
							"feed": feedMeta.title,
							"title": item.title,
							"link": item.link,
							"description": item.description
						});
						
						items.push(postModel);
						postModel.save();
					}
				})
				.on('end', function(){
					var result = {
						"title": feedMeta.title,
						"items": items
					};

					success(result);
				});
	});
};

// API

app.get('/posts', function(req, res) {
	PostModel.find(function (err, posts) {
		if (err) { 
			return console.error(err);
		}
		
		res.send(posts);
	})
});

app.post('/posts', function(req, res) {
	var postModel = new PostModel({ url: req.body.url });
	postModel.save(function (err) {
		if (!err) {
			res.send("Post with url " + postModel.url + " created");
			return console.log("Post with url " + postModel.url + " created");
		} else {
			return console.log(err);
		}
	});
});

app.post('/crawl', function(req, res) {
	fetchAndParseFeedUrl(req.body.url, function(result) {
		res.send(result);
	}, function(error) {
		res.send("failed with error: " + error);
	});
});

app.listen(3000);