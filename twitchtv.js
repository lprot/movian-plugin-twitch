/**
 * TwitchTV plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 lprot
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
    ['0', 'chunked', true], ['1', '720p60'], ['2', '720p30'], ['3', '480p30']
];
settings.createMultiOpt("videoQuality", "Video Quality", videoQualities, function(v) {
    service.videoQuality = v;
});
settings.createAction("cleanFavorites", "Clean My Favorites", function() {
    store.list = "[]";
    popup.notify('My Favorites has been cleaned successfully', 2);
});
settings.createBool('debug', 'Enable debug logging', false, function(v) {
    service.debug = v;
});
var store = require('movian/store').create('favorites');

if (!store.list) 
    store.list = "[]";

var API = 'https://api.twitch.tv/kraken';
var itemsPerPage = 50;
var header = {
    debug: service.debug, 
    headers: {
        'Client-ID':'awyezs6zu2vcnaekftdjy77evgk9jn'
    }
};

new page.Route(plugin.id + ":teams", function (page) {
    setPageHeader(page, plugin.title + ' - Teams');
    var tryToSearch = true, first = true;
    var url = API + '/teams?limit=' + itemsPerPage;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url, header));
        page.loading = false;
        for (var i in json.teams) {
            page.appendItem(plugin.id + ":team:" + encodeURIComponent(json.teams[i].name), "video", {
                title: new RichText(json.teams[i].display_name),
                icon: json.teams[i].logo,
                description: new RichText(coloredStr('Name: ', orange) + json.teams[i].name +
                    coloredStr('\nCreated at: ', orange) + json.teams[i].created_at.replace(/[T|Z]/g, ' ') +
                    coloredStr('\nUpdated at: ', orange) + json.teams[i].updated_at.replace(/[T|Z]/g, ' ') +
                    coloredStr('\nInfo: ', orange) + trim(json.teams[i].info)
                )
            });
            page.entries++;
        }
        if (json.teams.length == 0)
            return tryToSearch = false;
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
});

new page.Route(plugin.id + ":start", function (page) {
    setPageHeader(page, plugin.title + ' - Home');
    page.loading = true;
    page.appendItem(plugin.id + ":favorites", "directory", {
        title: "My Favorites"
    });
    page.appendItem(plugin.id + ":teams", "directory", {
        title: "The List of Teams"
    });
    var json = JSON.parse(http.request(API + '/streams/summary',header).toString());
    page.metadata.title += ' (Channels: ' + json.channels + ' Viewers: ' + json.viewers + ')';

    // Featured streams
    var json = JSON.parse(http.request(API + '/streams/featured',header));
    page.appendItem("", "separator", {
        title: 'Featured streams (' + json.featured.length + ')'
    });
    for (var i in json.featured) {
        page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.featured[i].stream.channel.name) + ':' + encodeURIComponent(json.featured[i].stream.channel.display_name), "video", {
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
    var url = API + '/games/top?limit=' + itemsPerPage;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first) {
            page.appendItem("", "separator", {
                title: 'Top Games (' + json._total + ')'
            });
            first = false;
        }
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
        if (json.top.length == 0)
            return tryToSearch = false;
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

new page.Route(plugin.id + ":team:(.*)", function(page, team) {
    setPageHeader(page, plugin.title + ' - Channels of: ' + decodeURIComponent(team));
    page.loading = true;
    var json = JSON.parse(http.request('http://api.twitch.tv/api/team/' + team + '/live_channels.json',header).toString());
    for (var i in json.channels) {
        page.appendItem(plugin.id + ":channel:" + encodeURIComponent(json.channels[i].channel.name)  + ':' + encodeURIComponent(json.channels[i].channel.display_name), "video", {
            title: new RichText(json.channels[i].channel.display_name + ' - ' + json.channels[i].channel.title + coloredStr(' (' + json.channels[i].channel.current_viewers + ')', orange)),
            icon: json.channels[i].channel.image.size600,
            description: new RichText(coloredStr('Viewing this channel: ', orange) + json.channels[i].channel.current_viewers +
                coloredStr('\nMeta game: ', orange) + json.channels[i].channel.meta_game +
                (json.channels[i].channel.total_views ? coloredStr('\nTotal views: ', orange) + json.channels[i].channel.total_views : '') +
                (json.channels[i].channel.followers_count ? coloredStr('\nChannel followers: ', orange) + json.channels[i].channel.followers_count : '') +
                (json.channels[i].channel.status ? coloredStr('\nChannel status: ', orange) + json.channels[i].channel.status : ''))
        });
    }

    if (json.channels.length == 0)
        page.appendPassiveItem('video', '', {
            title: 'Currently there is no live channels of this team'
        });
    page.loading = false;
});

new page.Route(plugin.id + ":video:(.*):(.*)", function (page, id, name) {
    setPageHeader(page, plugin.title + ' - ' + decodeURIComponent(name));
    page.loading = true;
    json = JSON.parse(http.request('https://api.twitch.tv/api/vods/' + id.slice(1) + '/access_token', header));

    // Download playlist and split it into multilines
    var playlist = http.request('https://usher.ttvnw.net/vod/' + id.slice(1) +
        '.m3u8?sig=' + json.sig + '&token=' + json.token +
        '&allow_source=true',header).toString().split('\n');

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
        title: unescape(name),
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
    var json = JSON.parse(http.request('https://api.twitch.tv/api/channels/' + name + '/access_token', header));

    // Download playlist and split it into multilines
    var playlist = http.request('http://usher.twitch.tv/api/channel/hls/' + name +
        '.m3u8?sig=' + json.sig + '&token=' + json.token +
        '&allow_source=true',header).toString().split('\n');

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
    page.loading = true;

    var url = API + '/channels/' + name + '/videos?broadcast_type=archive';
    var tryToSearch = true;

    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        for (var i in json.videos) {
            page.appendItem(plugin.id + ":video:" + json.videos[i]._id + ':' + encodeURIComponent(json.videos[i].title), "video", {
                title: new RichText(json.videos[i].title + coloredStr(' (' + json.videos[i].views + ')', orange)),
                icon: json.videos[i].preview,
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
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
});

new page.Route(plugin.id + ":user:(.*)", function (page, query) {
    setPageHeader(page, query);
    page.loading = true;
    var tryToSearch = true, first = true;
    var url = API + '/search/channels?q=' + encodeURIComponent(query) + '&limit=' + itemsPerPage;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first && page.metadata) {
            page.metadata.title +=  ' (' + json._total + ')';
            first = false;
        }
        for (var i in json.channels) {
            page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channels[i].name) + ':' + encodeURIComponent(json.channels[i].display_name), 'video', {
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
        url = json['_links'].next;
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
	var item = page.appendItem(plugin.id + ':channel:' + itemmd.name + ':' + itemmd.display_name, "video", {
            title: decodeURIComponent(itemmd.display_name)
	});
        addOptionForRemovingFromMyFavorites(page, item, decodeURIComponent(itemmd.name), pos);
        pos++;
    }
    page.loading = false;
}

// Favorites
new page.Route(plugin.id + ":favorites", function(page) {
    setPageHeader(page, "My Favorites");
    fill_fav(page);

});

new page.Route(plugin.id + ":channel:(.*):(.*)", function (page, name, display_name) {
    setPageHeader(page, plugin.title + ' - ' + decodeURIComponent(display_name));
    page.loading = true;
    page.options.createAction('addToFavorites', "Add '" + decodeURIComponent(display_name) + "' to My Favorites", function() {
        var entry = JSON.stringify({
            name: name,
            display_name: display_name
        });
        store.list = JSON.stringify([entry].concat(eval(store.list)));
        popup.notify("'" + decodeURIComponent(display_name) + "' has been added to My Favorites.", 2);
    });

    var tryToSearch = true, first = true;
    var json = JSON.parse(http.request(API + '/streams/' + name, header));
    page.metadata.background = json.stream.channel.video_banner;
    page.metadata.backgroundAlpha = 0.3;
    page.metadata.icon = json.stream.channel.logo;
    if (json.stream) {
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
                (json.stream.channel.followers ? coloredStr('\nChannel followers: ', orange) + json.stream.channel.followers : ''))
        });
        page.entries++;
    }
    page.appendItem(plugin.id + ":past:" + name + ':' + display_name, "directory", {
        title: 'Past broadcasts'
    });

    var url = API + '/channels/' + name + '/videos';
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (json.videos.length && first) {
            page.appendItem("", "separator", {
                title: 'Videos'
            });
            first = false;
        }
        for (var i in json.videos) {
            page.appendItem(plugin.id + ":video:" + json.videos[i]._id + ':' + encodeURIComponent(json.videos[i].title), "video", {
                title: new RichText(json.videos[i].title + coloredStr(' (' + json.videos[i].views + ')', orange)),
                icon: json.videos[i].preview,
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
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
    if (!page.entries)
        page.appendPassiveItem('video', '', {
            title: 'Currently this channel is empty :('
        });
});

function appendChannelItem(page, json) {
    page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channel.name) + ':' + encodeURIComponent(json.channel.display_name), 'video', {
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
    var url = API + '/streams?game=' + name + '&limit=' + itemsPerPage ;
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
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

page.Searcher(plugin.title + ' - Channels', logo, function (page, query) {
    setPageHeader(page, plugin.title + ' - Channels');
    page.loading = true;
    var tryToSearch = true, first = true;
    var url = API + '/search/channels?q=' + encodeURIComponent(query) + '&limit=' + itemsPerPage;
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first && page.metadata) {
            page.metadata.title +=  ' (' + json._total + ')';
            first = false;
        }
        for (var i in json.channels) {
            page.appendItem(plugin.id + ':channel:' + encodeURIComponent(json.channels[i].name) + ':' + encodeURIComponent(json.channels[i].display_name), 'video', {
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
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

page.Searcher(plugin.title + ' - Streams', logo, function (page, query) {
    setPageHeader(page, plugin.title + ' - Streams');
    page.loading = true;
    var tryToSearch = true, first = true;
    var url = API + '/search/streams?limit=' + itemsPerPage + '&q=' + encodeURIComponent(query);
    function loader() {
        if (!tryToSearch) return false;
        page.loading = true;
        var json = JSON.parse(http.request(url,header));
        if (first && page.metadata) {
            page.metadata.title +=  ' (' + json._total + ')';
            first = false;
        }
        for (var i in json.streams) 
            appendChannelItem(page, json.streams[i]);
        page.loading = false;
        if (json.streams.length == 0)
            return tryToSearch = false;
        url = json['_links'].next;
        return true;
    }
    loader();
    page.paginator = loader;
    page.loading = false;
});

page.Searcher(plugin.title + ' - Games', logo, function (page, query) {
    setPageHeader(page, plugin.title + ' - Games');
    page.loading = true;
    var json = JSON.parse(http.request(API + '/search/games?type=suggest&query=' + encodeURIComponent(query) + '&live=true',header));
    for (var i in json.games) {
        page.appendItem(plugin.id + ":game:" + encodeURIComponent(json.games[i].name), "video", {
            title: new RichText(json.games[i].name + coloredStr(' (' + json.games[i].popularity + ')', orange)),
            icon: json.games[i].box.large,
            description: new RichText(coloredStr('Popularity: ', orange) + json.games[i].popularity)
        });
        page.entries++;
    }
    page.loading = false;
});
