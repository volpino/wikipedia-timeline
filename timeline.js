var map;
var past_seconds = 0;
var firstedit;
var currentDate = new Date().getTime() / 1000;
var article_name;
var display_layer;
var current_geojson_data;
var current_edits;
var timerId;
var selectControl;
var selectedFeature;
var line;
var line_rel;
var max_rel;
var counter;
var lowerlimit;
var timedelta = 15552000;
var interval = 5;
var show_tips = false;
var speeds = ["Really slow", "Slow", "Normal", "Fast", "Really fast"];
var curr_speed = parseInt(speeds.length / 2);

var defaultStyle = new OpenLayers.Style({
                            graphicName: "circle",
                            strokeColor: "#ff0000",
                            fillColor: "#ff0000",
                            pointRadius: "${radius}",
                            fillOpacity: 0.5,
                            strokeWidth: "${width}"
                        },
                        { context : {
                                radius: function(feature) {
                                    if (feature.attributes.count == 1) return 3;
                                    return Math.min(Math.ceil(feature.attributes.count / 12), 25) + 5;
                                },
                            width: function(feature) {
                                    return (feature.attributes.count > 1) ? 2 : 0.5;
                                }
                            }
                        });

function main_lang() {
    return $("#lang_select").val();
}

function clearMap() {
    if (display_layer) {
        map.removeLayer(display_layer);
        display_layer = undefined;
    }
    if (selectControl) {
        selectControl.deactivate();
        map.removeControl(selectControl);
    }
    current_geojson_data = undefined;
    $("#slider-id").slider("value", 0);
    $("#slider-id").slider({ disabled: true });
    if (timerId) {
        clearInterval(timerId);
    }
    timerId = undefined;
    line = undefined;
    counter = undefined;
    $("#plot").html("");
    $.jqplot ('plot', [[0]]);
    $("#shortdesc").html("");
    resetPlay();
    if (map) {
        map.setCenter(new OpenLayers.LonLat(0, 0), 2);
    }
    interval = 5;
    curr_speed = parseInt(speeds.length / 2);
    updateSpeed();
    $('#search1').removeBubbletip();
    $('#search').removeBubbletip();
    $('#source').removeBubbletip();
}

function resetPlay() {
    var $elem = $('#pause');
    $elem.parent().append($elem);
}

function createDisplayLayer() {
    var l = new OpenLayers.Layer.Vector("display", {
                strategies: [new OpenLayers.Strategy.Cluster()],
                styleMap: defaultStyle
            });

    var features = [];
    current_edits = 0;
    if (current_geojson_data && current_geojson_data.features) {
        var f = current_geojson_data.features;
        for (var i=0; i<f.length; i++) {
            if (f[i].properties.when <= past_seconds) {
                current_edits++;
                if (!lowerlimit || f[i].properties.when >= lowerlimit) {
                    var p = f[i].geometry.coordinates;
                    var point = new OpenLayers.Geometry.Point(p[0], p[1]);
                    point.transform(new OpenLayers.Projection("EPSG:4326"), new OpenLayers.Projection("EPSG:900913"));
                    features.push(new OpenLayers.Feature.Vector(point));
                }
            }
            else {
                break;
            }
        }
    }

    map.addLayer(l);
    l.addFeatures(features);

    selectControl = new OpenLayers.Control.SelectFeature(
                        [l],{clickout: true, toggle: false,
                             multiple: false, hover: false }
                    );
    map.addControl(selectControl);
    selectControl.activate();
    l.events.on({
        "featureselected": function(e) {
            onFeatureSelect(e.feature);
        },
        "featureunselected": function(e) {
            onFeatureUnselect(e.feature);
        }
    });
    return l;
}

function createPlotData() {
    line = [];
    line_rel = [];
    var limit = firstedit;
    var increment = (currentDate-firstedit) / 200;
    counter = 0;
    max_rel = 0;
    var counter_rel = 0;
    var i = 0;
    line.push([(new Date(limit*1000)).toGMTString(), counter]);
    line_rel.push([(new Date(limit*1000)).toGMTString(), counter_rel]);
    if (current_geojson_data && current_geojson_data.features) {
        var f = current_geojson_data.features;
        while (i<f.length) {
            if (f[i].properties.when <= limit) {
                counter++;
                counter_rel++;
                i++;
            }
            else {
                line.push([(new Date(limit*1000)).toGMTString(), counter]);
                line_rel.push([(new Date(limit*1000)).toGMTString(), counter_rel]);
                if (counter_rel > max_rel) {
                    max_rel = counter_rel;
                }
                counter_rel = 0;
                limit += increment;
            }
        }
    }
    line.push([(new Date(currentDate*1000)).toGMTString(), counter]);
    line_rel.push([(new Date(limit*1000)).toGMTString(), counter_rel]);
}

function createPlot() {
    if (!line || !counter) {
        createPlotData();
    }
    var vert_prev = [[(new Date((past_seconds-timedelta)*1000)).toGMTString(), 0],
                     [(new Date((past_seconds-timedelta)*1000)).toGMTString(), counter]];
    var vert_line = [[(new Date(past_seconds*1000)).toGMTString(), 0],
                     [(new Date(past_seconds*1000)).toGMTString(), counter]];
    $("#plot").html("");
    var curr_line = line;
    var curr_max = current_geojson_data.features.length;
    if (!$("#incremental").attr("checked")) {
        curr_line = line_rel;
        curr_max = max_rel;
    }
    var lines = [curr_line, vert_line];
    if (!$("#incremental").attr("checked")) {
        lines.push(vert_prev);
    }

    var plot1 = $.jqplot('plot', lines, {
        series:[{showMarker:false},
                {lineWidth:1, color:'#FF0000', showMarker:false},
                {lineWidth:1, color:'#FF0000', showMarker:false}],
        axes:{xaxis:{renderer:$.jqplot.DateAxisRenderer,
                     tickOptions:{formatString:'%d/%m/%y'},
                     min: (new Date(firstedit*1000)).toGMTString(),
                     max: (new Date(currentDate*1000)).toGMTString(),
                     label:'Time',
                     labelRenderer: $.jqplot.CanvasAxisLabelRenderer},
              yaxis:{min: 0,
                     max: curr_max,
                     tickOptions: {formatString:'%d'},
                     label:'Edits',
                     labelRenderer: $.jqplot.CanvasAxisLabelRenderer}},
        highlighter: {
            show: false
        },
        cursor: {
            show: true,
            tooltipLocation:'sw',
            zoom: true,
        }
    });
}

function onPopupClose(evt) {
   selectControl.unselect(selectedFeature);
}

function onFeatureSelect(feature){
    if (feature.attributes.count > 1) {
        selectedFeature = feature;
        var desc = "";
        if (feature.cluster.length > 1) {
            desc += "<strong>" + feature.cluster.length + " edits from this area</strong><br/>";
        }
        if (feature.cluster.length > 1) {
            desc += "<br/><em>tip: increase the zoom level</em>";
        }
        desc += "</div>";
        popup = new OpenLayers.Popup.FramedCloud("chicken",
                    feature.geometry.getBounds().getCenterLonLat(),
                    new OpenLayers.Size(1000,500),
                    desc,
                    null,
                    true,
                    onPopupClose);
        feature.popup = popup;
        map.addPopup(popup);
    }
}

function onFeatureUnselect(feature) {
    map.removePopup(feature.popup);
    feature.popup.destroy();
    feature.popup = null;
}

function updateAutoComplete() {
    attachWikiAutoComplete("#search", "#lang_select");
    attachWikiAutoComplete("#search1", "#lang_select1");
}

function change_function(e, ui) {
    if (display_layer) {
        if (ui) {
            past_seconds = Math.ceil(firstedit + (currentDate-firstedit)*(ui.value / 100.0));
        }
        if (!$("#incremental").attr("checked")) {
            lowerlimit = past_seconds - timedelta;
        }
        else {
            lowerlimit = undefined;
        }
        map.removeLayer(display_layer);
        selectControl.deactivate();
        map.removeControl(selectControl);
    }
    display_layer = createDisplayLayer();
    if (display_layer.getDataExtent() && ($("#incremental").attr("checked"))) {
        map.zoomToExtent(display_layer.getDataExtent(), false);
    }
    if (current_geojson_data) {
        var d = new Date(past_seconds*1000);
        $("#shortdesc").html("History of the page \""+article_name+"\" @ "+d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear()+" Edits:"+current_edits);
        createPlot();
    }
}

function onLoad() {
    updateAutoComplete();

    var options = {
        projection: new OpenLayers.Projection("EPSG:900913"),
        displayProjection: new OpenLayers.Projection("EPSG:4326"),
        units: "m",
        numZoomLevels: 12,
        maxResolution: 156543.0339,
        maxExtent: new OpenLayers.Bounds(
            -20037500,
            -20037500,
            20037500,
            20037500
        ),
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.ArgParser(),
            new OpenLayers.Control.Attribution()
        ]
    };
    // avoid pink tiles
    OpenLayers.IMAGE_RELOAD_ATTEMPTS = 3;
    OpenLayers.Util.onImageLoadErrorColor = "transparent";

    map = new OpenLayers.Map("map", options);
    /*map.addLayer(new OpenLayers.Layer.XYZ("",
                 "http://s3.amazonaws.com/com.modestmaps.bluemarble/${z}-r${y}-c${x}.jpg",
                 {sphericalMercator: true, minZoomLevel: 3, numZoomLevels: 10}));
    */
    /*map.addLayer(new OpenLayers.Layer.TMS(
                    "MapBox blue marble",
                    [ "http://a.tiles.mapbox.com/mapbox/","http://b.tiles.mapbox.com/mapbox/",
                      "http://c.tiles.mapbox.com/mapbox/","http://d.tiles.mapbox.com/mapbox/" ],
                    { 'layername': "blue-marble-topo-bathy-jul",
                      'type': "png", minZoomLevel:3, numZoomLevels:9}));*/
    /*map.addLayer(new OpenLayers.Layer.TMS(
                    "MapBox glass",
                    [ "http://a.tiles.mapbox.com/mapbox/","http://b.tiles.mapbox.com/mapbox/",
                      "http://c.tiles.mapbox.com/mapbox/","http://d.tiles.mapbox.com/mapbox/" ],
                    { 'layername': "world-glass",
                      'type': "png", isBaseLayer:false, opacity:0.8}));
    */
    map.addLayer(new OpenLayers.Layer.TMS(
                 "political marble",
                 [ "http://de.straba.us/blue_marble_political/" ],
                 { 'layername': ".",
                 'type': "png", minZoomLevel:1, numZoomLevels:8}));

    map.addControl(new OpenLayers.Control.PanZoomBar());
    map.addControl(new OpenLayers.Control.MouseDefaults());
    map.addControl(new OpenLayers.Control.KeyboardDefaults());
    map.setCenter(new OpenLayers.LonLat(0, 0), 2);

    $("#slider-id").slider({
        value: 0,
        disabled: true,
        change: change_function,
        slide: function(e, ui) {
            stopBar();
            resetPlay();
            if (current_geojson_data) {
                past_seconds = Math.ceil(firstedit + (currentDate-firstedit)*(ui.value / 100.0));
                createPlot();
            }
        }
    });
}

function initmap(seconds) {
    //$("#shortdesc").html("Loading data...Please wait...");
    var url = "http://toolserver.org/~sonet/api_geojson.php?article="+encodeURI(article_name)+"&lang="+main_lang()+"&callback=?";
    $.getJSON(url, function(data) {
        $("#loading").fadeOut("slow");
        $("#shortdesc").html('Data loaded!');
        current_geojson_data = data;
        //display_layer = createDisplayLayer();
        createPlot();
        $("#slider-id").slider({ disabled: false });
        if (past_seconds - firstedit > 0) {
            $("#slider-id").slider("value", Math.ceil(((past_seconds-firstedit) / (currentDate-firstedit)) * 100));
        }

        if (!seconds) {
            setTimeout("togglePlay();", 1000);
        }

        if (show_tips) {
            setTimeout("mapTips();", 2000);
        }
    });
}

function mapTips() {
    $('#search').bubbletip($('#tip_search_page'), {
        deltaDirection: 'down',
        bindShow: 'focus',
        bindHide: 'blur'
    });
    $('#search').trigger('focus');

    $('#source').bubbletip($('#tip_links'));
    $('#source').trigger('mouseover');

    show_tips = false;
}

function startSearch() {
    if ($("#search_page").is(":visible")) {
        $("#search").val($("#search1").val());
        $("#lang_select").val($("#lang_select1").val());
    }
    $("#search_page").fadeOut(1500);
    $.History.go("|"+$("#lang_select").val()+"|"+encodeURI($("#search").val().replace(/\s+/g, "_")));
}

function randomSearch() {
    $("#search_page").fadeOut(1500);
    var url = "http://"+$("#lang_select1").val()+".wikipedia.org/w/api.php?action=query&list=recentchanges&rclimit=100&rcprop=sizes|title&rcnamespace=0&format=json&callback=?";
    $.getJSON(url, function(data) {
        var articles = [];
        $.each(data.query.recentchanges, function(elem) {
            var art = data.query.recentchanges[elem]
            if (art.type == "edit" && art.newlen >= 30000) {
                articles.push(data.query.recentchanges[elem].title);
            }
        });
        var rand = articles[Math.floor(Math.random() * articles.length)];
        $.History.go("|"+$("#lang_select1").val()+"|"+encodeURI(rand.replace(/\s+/g, "_")));
    });
}

function getData(seconds) {
    clearMap();
    $("#loading").fadeIn("slow");
    var url = "http://"+main_lang()+".wikipedia.org/w/api.php?action=query&prop=revisions&titles="+encodeURI(article_name)+"&rvlimit=1&rvprop=timestamp&rvdir=newer&format=json&redirects&callback=?";
    $.getJSON(url, function(data) {
        $.each(data.query.pages, function(id) {
            clearMap();
            if (data.query.pages[id]["revisions"]) {
                firstedit = (new Date(data.query.pages[id]["revisions"][0]["timestamp"])).getTime() / 1000;
                if (seconds) {
                    past_seconds = seconds;
                    $("#slider-id").slider("value", Math.ceil(((past_seconds-firstedit) / (currentDate-firstedit)) * 100));
                }
                else {
                    past_seconds = firstedit;
                }
                initmap(seconds);
                return false;
            }
            else {
            $.facebox("<p>We're sorry!</p><p>The page you requested has not been found!</p>");
            $("#loading").fadeOut("fast");
            return false;
            }
        });
    });
}

function animateBar() {
    if (!timerId && current_geojson_data) {
        if (100 - $("#slider-id").slider("value") <= 3) {
            $("#slider-id").slider("value", 0);
        }
        timerId = setInterval(function() {
            if (past_seconds < currentDate) {
                var curr_val = $("#slider-id").slider("value");
                $("#slider-id").slider("value", (curr_val+interval));
            }
            else {
                resetPlay();
                clearInterval(timerId);
                timerId = undefined;
            }
        }, 1500);
    }
}

function stopBar() {
    if (timerId) {
        clearInterval(timerId);
        timerId = undefined;
    }
}


function togglePlay() {
    var $elem = $('#player').children(':first');
    $elem.stop()
    .show()
    .animate({'marginTop':'-175px','marginLeft':'-175px','width':'350px','height':'350px','opacity':'0'},function(){
        $(this).css({'width':'100px','height':'100px','margin-left':'-50px','margin-top':'-50px','opacity':'1','display':'none'});
    });
    $elem.parent().append($elem);
    if (timerId) {
        stopBar();
    }
    else {
        animateBar();
    }
}

function fasterAnimation() {
    var $elem = $('#faster');
    $elem.stop()
    .show()
    .animate({'marginTop':'-175px','marginLeft':'-175px','width':'350px','height':'350px','opacity':'0'},function(){
        $(this).css({'width':'100px','height':'100px','margin-left':'-50px','margin-top':'-50px','opacity':'1','display':'none'});
    });
    $elem.parent().append($elem);
    if (interval < 15) {
        interval += 2;
        if (curr_speed < speeds.length-1) {
        }
        curr_speed++;
        updateSpeed();
        if (timerId) {
            stopBar();
            animateBar();
        }
    }
}

function slowerAnimation() {
    var $elem = $('#slower');
    $elem.stop()
    .show()
    .animate({'marginTop':'-175px','marginLeft':'-175px','width':'350px','height':'350px','opacity':'0'},function(){
        $(this).css({'width':'100px','height':'100px','margin-left':'-50px','margin-top':'-50px','opacity':'1','display':'none'});
    });
    $elem.parent().append($elem);
    if (interval >= 3) {
        interval -= 2;
        curr_speed--;
        updateSpeed();
    }
    if (timerId) {
        stopBar();
        animateBar();
    }
}

function updateSpeed() {
    var i;
    if (curr_speed >= speeds.length) {
        i = speeds.length - 1;
    }
    else if (curr_speed < 0) {
        i = 0;
    }
    else {
        i = curr_speed;
    }
    $("#curr_speed").html(speeds[i]);
}

function getPermalink() {
    var d = document.location.href;
    var inc = $("#incremental").attr("checked") ? 1 : 0;
    var current_url = d.substring(0, d.lastIndexOf('#'))+"#|"+main_lang()+"|"+encodeURI(article_name)+"|"+past_seconds+"|"+inc;
    var msg = "<p>This is the permalink for this page<p>" +
              "<textarea readonly='readonly'>" + current_url +
              "</textarea>" +
              "<textarea readonly='readonly' id='shorturl'>Loading bit.ly shorten url...</textarea>";
    $.facebox(msg);
    var defaults = {
        version:    '2.0.1',
        login:      'sonetfbk',
        apiKey:     'R_5d1118463acdf1f012b6b78b7eccf9d7',
        history:    '0',
        longUrl:    current_url
    };
    // Build the URL to query
    var daurl = "http://api.bit.ly/shorten?"
                +"version="+defaults.version
                +"&longUrl="+escape(defaults.longUrl)
                +"&login="+defaults.login
                +"&apiKey="+defaults.apiKey
                +"&history="+defaults.history
                +"&format=json&callback=?";
    // Utilize the bit.ly API
    $.getJSON(daurl, function(data){
        if (data.results) {
            var url = data.results[defaults.longUrl].shortUrl;
            $("#shorturl").html(url);
        }
        else {
            $("#shorturl").html("Error while getting the short url!");
        }
    });
}

function attachWikiAutoComplete(expression, lang) {
    $(expression).unautocomplete();
    $(expression).autocomplete("http://"+$(lang).val()+".wikipedia.org/w/api.php",  {
        dataType: "jsonp",
        parse: function(data) {
            var rows = new Array();
            var matches = data[1];
            for( var i = 0; i < matches.length; i++) {
                rows[i] = { data:matches[i], value:matches[i], result:matches[i] };
            }
            return rows;
        },
        formatItem: function(row) { return row; },
        extraParams: {
            action: "opensearch",
            format: "json",
            search: function () { return $(expression).val() }
        },
        max: 10
    });
    $(expression).result(function(event, data, formatted) {
        $(expression).val(formatted);
        startSearch();
    });
}

$(document).ready(function () {
    if (!window.location.hash) {
        clearMap();
        $("#search_page").show(0);
    }
    $.History.bind(function(state) {
        var states = state.split("|");
        if (states.length >= 4) {
            if (states.length == 5) {
                if (states[4] == 1) {
                    $("#incremental").attr("checked", true);
                }
                else {
                    $("#incremental").attr("checked", false);
                }
            }
            $("#search_page").hide(0);
            var seconds = parseInt(states[3]);
            var lang = states[1];
            var article = decodeURI(states[2].replace(/_/g, " "));
            $("#lang_select").val(lang);
            article_name = article;
            $("#search").val(article_name);
            $("#source_link").attr("href", "http://"+lang+".wikipedia.org/wiki/"+encodeURI(article_name));
            $("#manypedia_link").attr("href", "http://manypedia.com/#|"+lang+"|"+encodeURI(article_name));
            getData(seconds);
        }
        else if (states.length == 3) {
            $("#search_page").hide(0);
            var lang = states[1];
            var article = decodeURI(states[2]).replace(/_/g, " ");
            $("#lang_select").val(lang);
            article_name = article;
            $("#search").val(article_name);
            $("#source_link").attr("href", "http://"+lang+".wikipedia.org/wiki/"+encodeURI(article_name));
            $("#manypedia_link").attr("href", "http://manypedia.com/#|"+lang+"|"+encodeURI(article_name));
            getData();
        }
        else {
            clearMap();
            $("#search_page").show("fast");
        }
    });

    if ($.cookie("visited_timeline") !== "true") {
        $.cookie("visited_timeline", "true", {expires: 60*60*24});
        show_tips = true;
    }
    show_tips = true;
    if (show_tips && !window.location.hash) {
        $('#search1').bubbletip($('#tip_search_page'), {
            deltaDirection: 'right',
            bindShow: 'focus',
            bindHide: 'blur'
        });
        $('#search1').trigger('focus');
    }

    $.share_bar();

    $("#lang_select").change(function() {
        updateAutoComplete();
    });
    $("#lang_select1").change(function() {
        updateAutoComplete();
    });

    $('#playbutton').click(function(){
        togglePlay();
        return false;
    });

    $('#fastbutton').click(function(){
        fasterAnimation();
        return false;
    });

    $('#slowbutton').click(function(){
        slowerAnimation();
        return false;
    });

    $("#incremental").change(function() {
        map.setCenter(new OpenLayers.LonLat(0, 0), 2);
        createPlot();
        change_function();
    });
});

    /*$(document).keypress(function(e){
        if ((e.which && e.which == 32) || (e.keyCode && e.keyCode == 32)) {
            togglePlay();
            return false;
        } else {
            return true;
        }
    });*/
