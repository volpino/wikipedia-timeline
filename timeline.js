/**
  * Copyright (C) 2008, 2009 FBK Foundation, (http://www.fbk.eu)
  * Author: Federico Scrinzi @ SoNet Group
  *
  * WikiTrip is free software: you can redistribute it and/or modify
  * it under the terms of the GNU Affero General Public License as published by
  * the Free Software Foundation version 3 of the License.
  */

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
var max;
var max_rel;
var line_all;
var line_all_rel;
var lowerlimit;
var timedelta = 15552000;
var interval = 5;
var show_tips = false;
var speeds = ["Really slow", "Slow", "Normal", "Fast", "Really fast"];
var curr_speed = parseInt(speeds.length / 2);
var plot1, plot2;
var current_gender_data;
var current_api_data;
var loadUrl = "proxy.php";

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

function loadingTip() {
    var i = Math.ceil(Math.random()*($(".load_tip").length-1));
    $("#loading_tip").text("Tip: " + $(".load_tip:eq("+i+")").html());
}

function getHelp() {
    mapTips();
}

function removeBubbletip() {
    $('#search1').removeBubbletip();
    $('#search').removeBubbletip();
    $('#source').removeBubbletip();
    $('#stats').removeBubbletip();
    $('#plot').removeBubbletip();
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
    current_gender_data = undefined;
    $("#slider-id").slider("value", 0);
    $("#slider-id").slider({ disabled: true });
    if (timerId) {
        clearInterval(timerId);
    }
    timerId = undefined;
    line = undefined;
    resetPlot();
    $("#shortdesc").empty();
    resetPlay();
    if (map) {
        map.setCenter(new OpenLayers.LonLat(0, 0), 2);
    }
    interval = 5;
    curr_speed = parseInt(speeds.length / 2);
    updateSpeed();
    removeBubbletip();
    $("#gender_stats").empty();
}

function resetPlay() {
    var $elem = $('#pause');
    $elem.parent().append($elem);
}

function createDisplayLayer() {
    if (!map) {
        return false;
    }
    var l = new OpenLayers.Layer.Vector("display", {
                strategies: [new OpenLayers.Strategy.Cluster()],
                styleMap: defaultStyle
            });

    var features = [];
    current_edits = 0;
    var countries = {};
    var max = 0;
    if (current_geojson_data && current_geojson_data.features) {
        var top_countries = current_geojson_data.stats.top_countries;
        for (var i in top_countries) {
            countries[i] = 0.1;
            if (!lowerlimit && !max) {
                max = top_countries[i];
            }
        }

        var f = current_geojson_data.features;
        for (var i=0; i<f.length; i++) {
            if (f[i].properties.when <= past_seconds) {
                current_edits++;
                if (!lowerlimit || f[i].properties.when >= lowerlimit) {
                    // country plot data
                    var c = f[i].properties.country;
                    if (c in countries) {
                        countries[c]++;
                    }
                    if (lowerlimit && max < countries[c]) {
                        max = countries[c];
                    }
                    // map data
                    var p = f[i].geometry.coordinates;
                    var point = new OpenLayers.Geometry.Point(p[0], p[1]);
                    point.transform(new OpenLayers.Projection("EPSG:4326"),
                                    new OpenLayers.Projection("EPSG:900913"));
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

    createCountryPlot(countries, max);

    return l;
}

function createPlotData() {
    console.log(firstedit);
    line = [];
    line_rel = [];

    line_all = [];
    line_all_rel = [];

    max = 0;
    max_rel = 0;
    var first_day = (new Date(firstedit*1000)).getDate();
    if (current_api_data && current_api_data.year_count) {
        var f = current_api_data.year_count;
        var date;
        var c;
        var anon;
        var anon_cum = 0;
        $.each(f, function(year, value) {
            $.each(value.months, function(month, count_data) {
                date = year+"/"+month+"/"+first_day;
                if (line.length === 0) {
                    var first_point = year+"/"+month+"/"+(first_day-1);
                    console.log(first_point);
                    line.push([first_point, 0]);
                    line_rel.push([first_point, 0]);
                    line_all.push([first_point, 0]);
                    line_all_rel.push([first_point, 0]);
                }

                anon = count_data.anon;
                anon_cum += anon;

                c = count_data.cumulative - anon_cum;
                line_all.push([date, c]);
                line.push([date, anon_cum]);
                max = Math.max(max, anon_cum, c);

                c = count_data.all - anon;
                line_all_rel.push([date, c]);
                line_rel.push([date, anon]);
                max_rel = Math.max(max_rel, anon, c);
            });
        });
        // complete arrays with last point
        date = (new Date(currentDate*1000)).toGMTString()
        line.push([date, line[line.length-1][1]]);
        line_rel.push([date, line_rel[line_rel.length-1][1]]);
        line_all.push([date, line_all[line_all.length-1][1]]);
        line_all_rel.push([date, line_all_rel[line_all_rel.length-1][1]]);
    }
}

function resetPlot() {
    plot1 = undefined;
    $("#plot").empty();
}

function createPlot() {
    if (!line) {
        createPlotData();
    }
    var vert_prev = [[(new Date((past_seconds-timedelta)*1000)).toGMTString(), 0],
                     [(new Date((past_seconds-timedelta)*1000)).toGMTString(), max]];
    var vert_line = [[(new Date(past_seconds*1000)).toGMTString(), 0],
                     [(new Date(past_seconds*1000)).toGMTString(), max]];
    //$("#plot").empty();
    var curr_line = line;
    var curr_line_all = line_all;
    var curr_max = max;
    if (!$("#incremental").attr("checked")) {
        curr_line = line_rel;
        curr_line_all = line_all_rel;
        curr_max = max_rel;
    }
    var lines = [curr_line, curr_line_all, vert_line];
    if (!$("#incremental").attr("checked")) {
        lines.push(vert_prev);
    }

    if (!plot1) {
        plot1 = $.jqplot('plot', lines, {
            series:[{showMarker:false, label: "Anon edits"},
                    {showMarker:false, label: "User edits"},
                    {lineWidth:1, color:'#FF0000', showMarker:false},
                    {lineWidth:1, color:'#FF0000', showMarker:false}],
            axes:{xaxis:{renderer:$.jqplot.DateAxisRenderer,
                         tickOptions:{formatString:'%d/%m/%y'},
                         min: (new Date((firstedit-86400)*1000)).toGMTString(),
                         max: (new Date(currentDate*1000)).toGMTString(),
                         label:'Time',
                         labelRenderer: $.jqplot.CanvasAxisLabelRenderer},
                  yaxis:{min: 0,
                         max: curr_max,
                         tickOptions: {formatString:'%d'},
                         label:'Edits',
                         labelRenderer: $.jqplot.CanvasAxisLabelRenderer}},
            legend: {
                show: true,
                placement: 'outsideGrid'
            },
        });
    }
    else {
        for (var i=0; i<lines.length; i++) {
            plot1.series[i].data = lines[i];
        }
        plot1.replot();
    }
    $("#plot tbody").find("tr:gt(1)").remove();
}

function createCountryPlot(countries, max) {
    $("#countries_stats").empty();
    var bars = [];
    $.each(countries, function(k, v) {
        bars.push([k, v]);
    });
    if (bars.length==0) {
        bars = [["None", 0]];
    }

    plot2 = $.jqplot('countries_stats', [bars], {
        title: "Edits by country (anonymous users)",
        series:[{renderer:$.jqplot.BarRenderer,
                 rendererOptions: {varyBarColor:true}}],
        axesDefaults: {
          tickRenderer: $.jqplot.CanvasAxisTickRenderer ,
          tickOptions: {
            angle: -30,
            fontSize: '10pt',
            textColor: '#FFFFFF'
          },
        },
        axes: {
          xaxis: {
            renderer: $.jqplot.CategoryAxisRenderer
          },
          yaxis: {
            min: 0,
            max: max+10,
            tickOptions: {formatString: '%d'}
          }
        }
    });
}

function createGenderPlot() {
    if (!$("#gender_stats").html()) {
        $("#gender_stats").Loadingdotdotdot({
            "speed": 400,
            "maxDots": 4
        });
    }
    if (!current_gender_data) {
        return false;
    }

    var lines = {male: 0.1, female: 0.1};
    $.each(current_gender_data, function(elem) {
        var current = current_gender_data[elem];
        if (current.timestamp <= past_seconds) {
            if (!lowerlimit || current.timestamp >= lowerlimit) {
                lines[current.gender]++;
            }
        }
        else {
            return false;
        }
    });
    $("#gender_stats").empty();
    var plot3 = $.jqplot('gender_stats', [[["male", lines.male],
                                          ["female", lines.female]]], {
        title: "Edits by Gender (registered users)",
        series:[{renderer:$.jqplot.BarRenderer,
                 rendererOptions: { varyBarColor: true },
                 pointLabels: { show: true }}],
        axes: {
          xaxis: {
            renderer: $.jqplot.CategoryAxisRenderer
          },
          yaxis: {
            //max: current_gender_data.length,
            tickOptions: {formatString: '%d'},
            min: 0,
            max: (lines.male+lines.female)*2
          }
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
            past_seconds = Math.ceil(firstedit +
                           (currentDate-firstedit)*(ui.value / 100.0));
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
        $("#shortdesc").html("History of the page \""+article_name+"\" @ "+
                             d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear());
        createPlot();
    }
    createGenderPlot();
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
    var url = "http://toolserver.org/~sonet/api_geojson.php?article="+
              encodeURI(article_name)+"&lang="+main_lang()+"&callback=?";
    $.getJSON(url, function(data) {
        $("#loading").fadeOut("slow");
        $("#shortdesc").html('Data loaded!');
        current_geojson_data = data;
        display_layer = createDisplayLayer();
        createPlot();
        $("#slider-id").slider({ disabled: false });
        if (past_seconds - firstedit > 0) {
            $("#slider-id").slider("value", Math.ceil(((past_seconds-firstedit)
                                            / (currentDate-firstedit)) * 100));
        }

        if (!seconds) {
            setTimeout("togglePlay();", 1000);
        }

        if (show_tips) {
            setTimeout("mapTips();", 2000);
        }
    });

    url = "http://toolserver.org/~sonet/api_gender.php?article="+
          encodeURI(article_name)+"&lang="+main_lang()+"&callback=?"
    $.getJSON(url, function(data) {
        current_gender_data = data;
        createGenderPlot();
    });
}

function mapTips() {
    $('#search').bubbletip($('#tip_main_page'), {
        deltaDirection: 'down',
        bindShow: 'focus',
        bindHide: 'blur'
    });
    $('#search').trigger('focus');
    setTimeout(function () { $('#search').trigger('blur') }, 5000);

    $('#source').bubbletip($('#tip_links'));
    $('#source').trigger('mouseover');
    setTimeout(function () { $('#source').trigger('mouseout') }, 5000);

    $('#plot').bubbletip($('#plot_tip'), {deltaDirection:'down'});
    $('#plot').trigger('mouseover');
    setTimeout(function () { $('#plot').trigger('mouseout') }, 5100);

    $('#stats').bubbletip($('#right_plot_tip'), {deltaDirection: 'left'});
    $('#stats').trigger('mouseover');
    setTimeout(function () { $('#stats').trigger('mouseout') }, 5000);

    show_tips = false;
}

function startSearch() {
    if ($("#search_page").is(":visible")) {
        $("#search").val($("#search1").val());
        $("#lang_select").val($("#lang_select1").val());
    }
    $("#search").unautocomplete();
    $("#search1").unautocomplete();
    removeBubbletip();
    if ($("#search").val()) {
        $("#search_page").fadeOut(1500);
        $.History.go("|"+$("#lang_select").val()+"|"+encodeURI($("#search").val().replace(/\s+/g, "_")));
    }
}

function randomSearch() {
    $("#search_page").fadeOut(1500);
    $("#loading_page").hide(0);
    var lang = $("#lang_select1").val().toUpperCase();
    removeBubbletip();
    $.ajax({
        url: loadUrl + "?url=" + "http://stats.wikimedia.org/EN/TablesWikipediaArticleEdits"+lang+".htm",
        success: function(data) {
            var reg = /e\(\d+,\d+,\d+,\d+,".+?","(.+?)"\)/g;
            var match;
            var res = [];
            while (match = reg.exec(data)) {
                if (match[1].search(/\:/) === -1) {
                    res.push(match[1]);
                }
            }
            var rand = res[Math.floor(Math.random() * res.length)];
            $("#loading_page").fadeIn("fast");
            $.History.go("|"+$("#lang_select1").val()+"|"+encodeURI(rand.replace(/\s+/g, "_")));
        }
    });
}

function getData(seconds) {
    loadingTip();
    $("#article_name").text(article_name);
    $("#lang").text(main_lang());
    $("#loading").fadeIn("slow");
    var url = "http://toolserver.org/~sonet/api.php?article="+
              encodeURI(article_name)+"&lang="+main_lang()+"&year_count&callback=?";
    $.getJSON(url, function(data) {
        current_api_data = data;
        if (data.first_edit) {
            clearMap();
            updateAutoComplete();
            firstedit = data.first_edit.timestamp;
            if (seconds) {
                past_seconds = seconds;
                $("#slider-id").slider("value", Math.ceil(((past_seconds-firstedit) / (currentDate-firstedit)) * 100));
            }
            else {
                past_seconds = firstedit;
            }
            initmap(seconds);
        }
        else {
            $.facebox("<p>We're sorry!</p><p>The page you requested has not been found!</p>");
            $("#search_page").fadeIn("fast");
            updateAutoComplete();
        }
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
        }, 1000);
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
    //show_tips = true;
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
        resetPlot();
        change_function();
    });

    $("#dotdot").Loadingdotdotdot({
        "speed": 400,
        "maxDots": 4
    });

    $("#search1").clickOnEnter("#search1_btn");
    $("#search").clickOnEnter("#search_btn");

    $('a[rel*=facebox]').facebox()
});

    /*$(document).keypress(function(e){
        if ((e.which && e.which == 32) || (e.keyCode && e.keyCode == 32)) {
            togglePlay();
            return false;
        } else {
            return true;
        }
    });*/
