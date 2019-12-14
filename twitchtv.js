/**
 * TwitchTV plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2019 lprot
 *  Based on the plugin of Fábio Ferreira (facanferff)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');
var popup = require('native/popup');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';
function colorStr(str, color) {
    return '<font color="' + color + '"> (' + str + ')</font>';
}

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.entries = 0;
    page.loading = false;
}

function log(str) {
    if (service.debug) console.log(str);
}

function trim(s) {
    return s.replace(/(\r\n|\n|\r)/gm, "").replace(/(^\s*)|(\s*$)/gi, "").replace(/[ ]{2,}/gi, " ");
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);
settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createInfo("info", logo, plugin.synopsis);
var videoQualities = [
    ['0', 'chunked', true], ['1', '1080p30'], ['2', '720p60'], ['3', '720p30'], ['4', '480p60'], ['5', '480p30']
];
var defaultvidq;
settings.createMultiOpt("videoQuality", "Video Quality", videoQualities, function(v) {
    service.videoQuality = v;
	defaultvidq = v;
});
settings.createAction("cleanFavorites", "Clean My Favorites", function() {
    store.list = "[]";
    popup.notify('My Favorites has been cleaned successfully', 2);
});
settings.createBool('debug', 'Enable debug logging', false, function(v) {
    service.debug = v;
});
settings.createBool('overridevidq', 'Override default video quality setting', false, function(v) {
    service.overridevidq = v;
});
settings.createBool('disablebg', 'Disable channel background overlay', false, function(v) {
    service.disablebg = v;
});

var store = require('movian/store').create('favorites');

if (!store.list)
    store.list = "[]";

var API = 'https://api.twitch.tv/kraken';
var itemsPerPage = 50;
var header = {
    debug: service.debug,
    headers: {
		'Accept': 'application/vnd.twitchtv.v5+json',
        'Client-ID':'awyezs6zu2vcnaekftdjy77evgk9jn'
    }
};
var header_twitch = {
    debug: service.debug,
    headers: {
		'Accept': 'application/vnd.twitchtv.v5+json',
        'Client-ID':'kimne78kx3ncx6brgo4mv6wki5h1ko'
    }
};

var API_NEW = 'https://api.twitch.tv/helix';
var header_new = {
    debug: service.debug,
    headers: {
        'Client-ID':'kimne78kx3ncx6brgo4mv6wki5h1ko'
    }
};

new page.Route(plugin.id + ":start", function (page) {
    setPageHeader(page, plugin.title + ' - Home');
    page.options.createMultiOpt("videoQuality", "Video Quality", videoQualities, function(v) {
		if (service.overridevidq == true)
		{
			service.videoQuality = v;
		}
		else
			service.videoQuality = defaultvidq;
    });
    page.loading = true;
    page.appendItem(plugin.id + ":favorites", "directory", {
        title: "My Favorites",
        icon: logo
    });
    var json = JSON.parse(http.request(API + '/streams/summary',header).toString());
    page.metadata.title += ' (Channels: ' + json.channels + ' Viewers: ' + json.viewers + ')';

    // Featured streams
    var json = JSON.parse(http.request(API + '/streams/featured',header));
    page.appendItem("", "separator", {
        title: 'Featured streams (' + json.featured.length + ')'
    });
    for (var i in json.featured) {
        page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.featured[i].stream.channel._id) + ':' + encodeURIComponent(json.featured[i].stream.channel.display_name) + ':' + encodeURIComponent(json.featured[i].stream.channel.name), "video", {
            title: new RichText((json.featured[i].stream.game ? json.featured[i].stream.game + ' - ' : '') + json.featured[i].stream.channel.display_name + coloredStr(' (' + json.featured[i].stream.viewers + ')', orange)),
            icon: json.featured[i].image,
            backdrops: [{url: json.featured[i].stream.preview.large}],
            genre: new RichText((json.featured[i].stream.channel.language ? coloredStr('Language: ', orange) + json.featured[i].stream.channel.language : '') +
                (json.featured[i].stream.channel.mature ? coloredStr('\nMature: ', orange) + json.featured[i].stream.channel.mature : '') +
                (json.featured[i].sponsored ? coloredStr('\nSponsored: ', orange) + json.featured[i].sponsored : '')),
            tagline: new RichText(json.featured[i].stream.channel.status ? json.featured[i].stream.channel.status : ''),
            description: new RichText(coloredStr('Viewing this stream: ', orange) + json.featured[i].stream.viewers +
                coloredStr(' Created at: ', orange) + json.featured[i].stream.created_at.replace(/[T|Z]/g, ' ') +
                coloredStr('\nChannel created at: ', orange) + json.featured[i].stream.channel.created_at.replace(/[T|Z]/g, ' ') +
                coloredStr('\nChannel updated at: ', orange) + json.featured[i].stream.channel.updated_at.replace(/[T|Z]/g, ' ') +
                (json.featured[i].stream.channel.views ? coloredStr('\nChannel views: ', orange) + json.featured[i].stream.channel.views : '') +
                (json.featured[i].stream.channel.followers ? coloredStr(' Channel followers: ', orange) + json.featured[i].stream.channel.followers : '') +
                (json.featured[i].text ? json.featured[i].text : ''))
        });
    }

    // Top Games
    var tryToSearch = true, first = true;

	/*
	// Using the new api
    var url = API_NEW + '/games/top';
	var cursor = "";

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url + (cursor ? "?after="+cursor : ""), header_new));
        if (first) {
            page.appendItem("", "separator", {
                title: 'Top Games'
            });
            first = false;
        }
		cursor = json.pagination.cursor;

        for (var i in json.data) {
            if (!json.data[i].name) // db errors?
                continue;
            page.appendItem(plugin.id + ":game:" + encodeURIComponent(json.data[i].name), "video", {
                title: new RichText(json.data[i].name),
                icon: json.data[i].box_art_url.replace("{width}x{height}", "260x300"),
            });
            page.entries++;
        }
        page.loading = false;
        if (json.data.length == 0)
            return tryToSearch = false;
		return true;
    }

    loader();
    page.paginator = loader;
    page.loading = false;

	*/

	// Using api v5
	var url = API + '/games/top?limit=100';

	page.loading = true;
	var json = JSON.parse(http.request(url, header));
	page.appendItem("", "separator", {title: 'Top 100 Games'});

	for (var i in json.top) {
		if (!json.top[i].game.name) // db errors?
			continue;
		page.appendItem(plugin.id + ":game:" + encodeURIComponent(json.top[i].game.name), "video", {
			title: new RichText(json.top[i].game.name + coloredStr(' (' + json.top[i].viewers + ')', orange)),
			icon: json.top[i].game.box.large,
			backdrops: [{url: json.top[i].game.logo.large}],
			description: new RichText(coloredStr('Viewers: ', orange) + json.top[i].viewers +
				coloredStr('\nChannels: ', orange) + json.top[i].channels)
		});
		page.entries++;
	}
	page.loading = false;

});

new page.Route(plugin.id + ":video:(.*):(.*)", function (page, id, name) {
    setPageHeader(page, plugin.title + ' - ' + decodeURIComponent(name));
    page.loading = true;
    json = JSON.parse(http.request('https://api.twitch.tv/api/vods/' + id.slice(1) + '/access_token', header_twitch));
    // Download playlist and split it into multilines
    var playlist = http.request('https://usher.ttvnw.net/vod/' + id.slice(1) +
        '?player=twitchweb&sig=' + json.sig + '&token=' + encodeURIComponent(json.token) +
        '&allow_source=true&p=8',header).toString().split('\n');

    var url = 0;

    // Loop through the playlist and select preferred quality
    for (var line = 0; line < playlist.length; line++) {
        if (playlist[line].indexOf('EXT-X-MEDIA:TYPE=VIDEO') > -1) {
            url = playlist[line + 2];
            if (playlist[line].indexOf(videoQualities[service.videoQuality].toString().split(',')[1]) > -1 || !service.videoQuality)
                break;
        }
    }
    page.loading = false;

    if (!url) {
        page.error("Cannot find stream URL.");
        return;
    }

    //json = JSON.parse(http.request(API + '/videos/' + id, header));

    page.type = "video";
    page.source = "videoparams:" + JSON.stringify({
        title: decodeURIComponent(name),
        sources: [{
            url: 'hls:' + url
        }],
        no_subtitle_scan: true
    });
    page.loading = false;
});

new page.Route(plugin.id + ":play:(.*)", function (page, name) {
    // Get sig and token
    page.loading = true;
    var json = JSON.parse(http.request('https://api.twitch.tv/api/channels/' + name + '/access_token', header_twitch));

    // Download playlist and split it into multilines
    var playlist = http.request('https://usher.ttvnw.net/api/channel/hls/' + name +
        '.m3u8?player=twitchweb&sig=' + json.sig + '&token=' + encodeURIComponent(json.token) +
        '&allow_source=true&p=71',header).toString().split('\n');

    var url = null;

    // Loop through the playlist and select preferred quality
    for (var line = 0; line < playlist.length; line++) {
        if (playlist[line].indexOf('EXT-X-MEDIA:TYPE=VIDEO') > -1) {
            var url = playlist[line + 2];
            if (playlist[line].indexOf(videoQualities[service.videoQuality].toString().split(',')[1]) > -1 || !service.videoQuality)
                break;
        }
    }

    page.loading = false;

    if (!url) {
        page.error("Cannot find stream URL.");
        return;
    }

    page.type = "video";
    page.source = "videoparams:" + JSON.stringify({
        title: name,
        sources: [{
            url: 'hls:' + url
        }],
        no_subtitle_scan: true
    });
});

new page.Route(plugin.id + ":past:(.*):(.*)", function (page, name, display_name) {
    setPageHeader(page, plugin.title + ' - Past broadcasts for: ' + decodeURIComponent(display_name));
    page.options.createMultiOpt("videoQuality", "Video Quality", videoQualities, function(v) {
	if (service.overridevidq == true)
		{
			service.videoQuality = v;
		}
		else
			service.videoQuality = defaultvidq;
    });
    page.loading = true;

	var offset = 0;
    var url = API + '/channels/' + name + '/videos?broadcast_type=archive&limit='+itemsPerPage+'&offset='+offset;
    var tryToSearch = true;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        for (var i in json.videos) {
            page.appendItem(plugin.id + ":video:" + json.videos[i]._id + ':' + encodeURIComponent(json.videos[i].title), "video", {
                title: new RichText(json.videos[i].title + coloredStr(' (' + json.videos[i].views + ')', orange)),
                icon: json.videos[i].preview.medium,
                duration: json.videos[i].length,
                description: new RichText(coloredStr('Views: ', orange) + json.videos[i].views +
                    (json.videos[i].game ? coloredStr('\nGame: ', orange) + json.videos[i].game : '') +
                    (json.videos[i].recorded_at ? coloredStr('\nRecorded at: ', orange) + json.videos[i].recorded_at.replace(/[T|Z]/g, ' ') : '') +
                    (json.videos[i].description ? coloredStr('\nDescription: ', orange) + json.videos[i].description : ''))
            });
            page.entries++;
        }
        page.loading = false;
        if (json.videos.length == 0)
            return tryToSearch = false;
        // url = json['_links'].next;
		offset+=itemsPerPage;
        return true;
    }
    loader();
    page.paginator = loader;
});

new page.Route(plugin.id + ":user:(.*)", function (page, query) {
    setPageHeader(page, query);
    page.loading = true;
    var tryToSearch = true, first = true;
	var offset = 0;
    var url = API + '/search/channels?query=' + encodeURIComponent(query) + '&limit=' + itemsPerPage+'&offset='+offset;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first && page.metadata) {
            page.metadata.title +=  ' (' + json._total + ')';
            first = false;
        }
        for (var i in json.channels) {
            page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channels[i]._id) + ':' + encodeURIComponent(json.channels[i].display_name) + ':' + encodeURIComponent(json.channels[i].name), 'video', {
                title: json.channels[i].display_name + (json.channels[i].game ? ' - ' + json.channels[i].game : ''),
                icon: json.channels[i].logo,
                description: new RichText((json.channels[i].views ? coloredStr('\nChannel views: ', orange) + json.channels[i].views : '') +
                    coloredStr('\nCreated at: ', orange) + json.channels[i].created_at.replace(/[T|Z]/g, ' ') +
                    coloredStr('\nUpdated at: ', orange) + json.channels[i].updated_at.replace(/[T|Z]/g, ' ') +
                    (json.channels[i].mature ? coloredStr('\nMature: ', orange) + json.channels[i].mature : '') +
                    (json.channels[i].language ? coloredStr('\nLanguage: ', orange) + json.channels[i].language : '') +
                    (json.channels[i].followers ? coloredStr('\nFollowers: ', orange) + json.channels[i].followers : '') +
                    (json.channels[i].status ? coloredStr('\nStatus: ', orange) + json.channels[i].status : ''))
            });
            page.entries++;
        }
        page.loading = false;
        if (json.channels.length == 0)
            return tryToSearch = false;
        // url = json['_links'].next;
		offset += itemsPerPage;

        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

function addOptionForRemovingFromMyFavorites(page, item, title, pos) {
    item.addOptAction("Remove '" + title + "' from My Favorites", function() {
        var list = eval(store.list);
        popup.notify("'" + title + "' has been removed from My Favorites.", 2);
        list.splice(pos, 1);
        store.list = JSON.stringify(list);
        page.redirect(plugin.id + ':favorites');
    });
}

function fill_fav(page) {
    page.loading = true;
    var list = eval(store.list);

    if (!list || !list.toString()) {
        page.error("My Favorites list is empty");
        return;
    }
    var pos = 0;
    for (var i in list) {
        var itemmd = JSON.parse(list[i]);
	var item = page.appendItem(plugin.id + ':channel:' + itemmd.name + ':' + itemmd.display_name + ':' + itemmd.name, "video", {
            title: decodeURIComponent(itemmd.display_name),
            icon: decodeURIComponent(itemmd.icon)
	});
        addOptionForRemovingFromMyFavorites(page, item, decodeURIComponent(itemmd.display_name), pos);
        pos++;
    }
    page.loading = false;
}

// Favorites
new page.Route(plugin.id + ":favorites", function(page) {
    setPageHeader(page, "My Favorites");
    fill_fav(page);

});

new page.Route(plugin.id + ":channel:(.*):(.*):(.*)", function (page, name, display_name, name2) {
    setPageHeader(page, plugin.title + ' - ' + decodeURIComponent(display_name));
    page.options.createMultiOpt("videoQuality", "Video Quality", videoQualities, function(v) {
	if (service.overridevidq == true) {
            service.videoQuality = v;
        } else
            service.videoQuality = defaultvidq;
    });
    page.loading = true;
    var tryToSearch = true, first = true;
    var json = JSON.parse(http.request(API + '/streams/' + name, header));
    if (json.stream) {
        if (service.disablebg == false) {
            page.metadata.background = json.stream.channel.video_banner;
            }
        page.metadata.backgroundAlpha = 0.3;
        page.metadata.logo = json.stream.channel.logo;
        page.appendItem("", "separator", {
            title: 'Stream'
        });
        page.appendItem(plugin.id + ":play:" + encodeURIComponent(json.stream.channel.name), "video", {
            title: new RichText((json.stream.game ? json.stream.game + ' - ' : '') + json.stream.channel.display_name + coloredStr(' (' + json.stream.viewers + ')', orange)),
            icon: json.stream.channel.logo,
            backdrops: [{url: json.stream.preview.large}],
            genre: new RichText((json.stream.channel.language ? coloredStr('Language: ', orange) + json.stream.channel.language : '') +
                (json.stream.channel.mature ? coloredStr('\nMature: ', orange) + json.stream.channel.mature : '')),
            tagline: json.stream.channel.status,
            description: new RichText(coloredStr('Viewing this stream: ', orange) + json.stream.viewers +
                coloredStr('\nStream created at: ', orange) + json.stream.created_at.replace(/[T|Z]/g, ' ') +
                coloredStr('\nChannel created at: ', orange) + json.stream.channel.created_at.replace(/[T|Z]/g, ' ') +
                coloredStr('\nChannel updated at: ', orange) + json.stream.channel.updated_at.replace(/[T|Z]/g, ' ') +
                (json.stream.channel.views ? coloredStr('\nChannel views: ', orange) + json.stream.channel.views : '') +
                (json.stream.channel.followers ? coloredStr('\nChannel followers: ', orange) + json.stream.channel.followers : '') +
                (json.stream.video_height ? coloredStr('\nNative resolution: ', orange) + json.stream.video_height : '') + "p" + (json.stream.average_fps ? Math.round(json.stream.average_fps) : ''))
        });
        page.entries++;
    }
    page.options.createAction('addToFavorites', "Add '" + decodeURIComponent(display_name) + "' to My Favorites", function() {
        var json = JSON.parse(http.request(API + '/channels/' + name, header));
		console.log(json);
        var entry = JSON.stringify({
            name: name,
            display_name: display_name,
            icon: json ? json.logo : void(0)
        });
        store.list = JSON.stringify([entry].concat(eval(store.list)));
        popup.notify("'" + decodeURIComponent(display_name) + "' has been added to My Favorites.", 2);
    });
    page.appendItem(plugin.id + ":past:" + name + ':' + display_name, "directory", {
        title: 'Past broadcasts'
    });

	page.loading = true;
	var url = API_NEW + '/videos?user_id=' + name + '&type=highlight&first=25';
	var json = JSON.parse(http.request(url, header));
	if(json.data && json.data.length)
	{
		page.appendItem("", "separator", {title: 'Highlights'});

		for (var i in json.data)
		{
			page.appendItem(plugin.id + ":video:v" + json.data[i].id + ':' + encodeURIComponent(json.data[i].title), "video",
			{
				title: new RichText(json.data[i].title + coloredStr(' (' + json.data[i].view_count + ')', orange)),
				icon: json.data[i].thumbnail_url.replace("%{width}x%{height}", "320x180"),
				duration: json. data[i].duration,
				description: new RichText(coloredStr('Views: ', orange) + json.data[i].view_count +
				//    (json.videos[i].game ? coloredStr('\nGame: ', orange) + json.videos[i].game : '') +
					(json.data[i].created_at ? coloredStr('\nCreated: ', orange) + json.data[i].created_at.replace(/[T|Z]/g, ' ') : '') +
					(json.data[i].description ? coloredStr('\nDescription: ', orange) + json.data[i].description : '')
					)
			});
			page.entries++;
		}
	}

	var url = API_NEW + '/videos?user_id=' + name + '&type=all&sort=views&first=25';
	var json = JSON.parse(http.request(url, header));
	if(json.data && json.data.length)
	{
		page.appendItem("", "separator", {title: 'Top'});

		for (var i in json.data)
		{
			page.appendItem(plugin.id + ":video:v" + json.data[i].id + ':' + encodeURIComponent(json.data[i].title), "video",
			{
				title: new RichText(json.data[i].title + coloredStr(' (' + json.data[i].view_count + ')', orange)),
				icon: json.data[i].thumbnail_url.replace("%{width}x%{height}", "320x180"),
				duration: json. data[i].duration,
				description: new RichText(coloredStr('Views: ', orange) + json.data[i].view_count +
				//    (json.videos[i].game ? coloredStr('\nGame: ', orange) + json.videos[i].game : '') +
					(json.data[i].created_at ? coloredStr('\nCreated: ', orange) + json.data[i].created_at.replace(/[T|Z]/g, ' ') : '') +
					(json.data[i].description ? coloredStr('\nDescription: ', orange) + json.data[i].description : '')
					)
			});
			page.entries++;
		}
	}

	page.loading = false;
});

function appendChannelItem(page, json) {
    page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channel._id) + ':' + encodeURIComponent(json.channel.display_name) + ':' + encodeURIComponent(json.channel.name), 'video', {
        title: new RichText(json.channel.display_name + coloredStr(' (' + json.viewers + ')', orange)),
        icon: json.channel.logo,
        backdrops: [{url: json.preview.large}],
        genre: new RichText((json.channel.language ? coloredStr('Language: ', orange) + json.channel.language : '') +
            (json.channel.mature ? coloredStr('\nMature: ', orange) + json.channel.mature : '')),
        tagline: new RichText(json.channel.status ? json.channel.status : ''),
        description: new RichText(coloredStr('Viewing this stream: ', orange) + json.viewers +
            coloredStr('\nStream created at: ', orange) + json.created_at.replace(/[T|Z]/g, ' ') +
            coloredStr('\nChannel created at: ', orange) + json.channel.created_at.replace(/[T|Z]/g, ' ') +
            coloredStr('\nChannel updated at: ', orange) + json.channel.updated_at.replace(/[T|Z]/g, ' ') +
            (json.channel.views ? coloredStr('\nChannel views: ', orange) + json.channel.views : '') +
            (json.channel.followers ? coloredStr('\nChannel followers: ', orange) + json.channel.followers : ''))
    });
    page.entries++;
}

new page.Route(plugin.id + ":game:(.*)", function (page, name) {
    setPageHeader(page, 'Channels casting: ' + decodeURIComponent(name));
    page.loading = true;
    var tryToSearch = true, first = true;
	var offset = 0;
    var url = API + '/streams?game=' + name + '&limit=' + itemsPerPage +'&offset='+offset; ;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first) {
            page.metadata.title +=  ' (' + json._total + ')';
            first = false;
        }
        for (var i in json.streams)
            appendChannelItem(page, json.streams[i]);
        page.loading = false;
        if (json.streams.length == 0)
            return tryToSearch = false;
        // url = json['_links'].next;
		offset += itemsPerPage;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

/*
page.Searcher(plugin.title + ' - Channels', logo, function (page, query) {
    var url = API + '/search/channels?query=' + encodeURIComponent(query) + '&limit=' + itemsPerPage;
	var json = JSON.parse(http.request(url, header));
	for (var i in json.channels) {
		page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channels[i]._id) + ':' + encodeURIComponent(json.channels[i].display_name), 'video', {
			title: json.channels[i].display_name + (json.channels[i].game ? ' - ' + json.channels[i].game : ''),
			icon: json.channels[i].logo,
			description: new RichText((json.channels[i].views ? coloredStr('\nChannel views: ', orange) + json.channels[i].views : '') +
				coloredStr('\nCreated at: ', orange) + json.channels[i].created_at.replace(/[T|Z]/g, ' ') +
				coloredStr('\nUpdated at: ', orange) + json.channels[i].updated_at.replace(/[T|Z]/g, ' ') +
				(json.channels[i].mature ? coloredStr('\nMature: ', orange) + json.channels[i].mature : '') +
				(json.channels[i].language ? coloredStr('\nLanguage: ', orange) + json.channels[i].language : '') +
				(json.channels[i].followers ? coloredStr('\nFollowers: ', orange) + json.channels[i].followers : '') +
				(json.channels[i].status ? coloredStr('\nStatus: ', orange) + json.channels[i].status : ''))
		});
		page.entries++;
	}
});


page.Searcher(plugin.title + ' - Streams', logo, function (page, query) {
    var url = API + '/search/streams?limit=' + itemsPerPage + '&hls=true&q=' + encodeURIComponent(query);
	var json = JSON.parse(http.request(url, header));
	for (var i in json.streams)
		appendChannelItem(page, json.streams[i]);
});
*/

page.Searcher(plugin.title + ' - Games', logo, function (page, query) {
    var json = JSON.parse(http.request(API + '/search/games?type=suggest&query=' + encodeURIComponent(query) + '&live=true',header));
    for (var i in json.games) {
        page.appendItem(plugin.id + ":game:" + encodeURIComponent(json.games[i].name), "video", {
            title: new RichText(json.games[i].name + coloredStr(' (' + json.games[i].popularity + ')', orange)),
            icon: json.games[i].box.large,
            description: new RichText(coloredStr('Popularity: ', orange) + json.games[i].popularity)
        });
        page.entries++;
    }
});
