(function($) {
  $.share_bar = function() {
    var url = window.location.href;
    var host =  window.location.hostname;

    var tbar = '<div id="socializethis"><span>Share<br /><a href="javascript:void(0)" id="minimize" title="Minimize"> <img src="images/minimize.png" /> </a></span><div id="sicons">';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'twit\');" id="twit" title="Share on twitter"><img src="images/twitter.png"  alt="Share on Twitter" width="32" height="32" /></a>';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'facebook\');" id="facebook" title="Share on Facebook"><img src="images/facebook.png"  alt="Share on facebook" width="32" height="32" /></a>';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'digg\');" id="digg" title="Share on Digg"><img src="images/digg.png"  alt="Share on Digg" width="32" height="32" /></a>';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'stumbleupon\');" id="stumbleupon" title="Share on Stumbleupon"><img src="images/stumbleupon.png"  alt="Share on Stumbleupon" width="32" height="32" /></a>';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'delicious\')" id="delicious" title="Share on Del.icio.us"><img src="images/delicious.png"  alt="Share on Delicious" width="32" height="32" /></a>';
    tbar += '<a href="javascript:void(0)" onclick="share_link(\'buzz\')" id="buzz" title="Share on Buzz"><img src="images/google-buzz.png"  alt="Share on Buzz" width="32" height="32" /></a>';
    tbar += '</div></div>';

    // Add the share tool bar.
    $('body').append(tbar);
    $('#socializethis').css({opacity: .7});
    // hover.
    $('#socializethis').bind('mouseenter',function(){
      $(this).animate({height:'35px', width:'260px', opacity: 1}, 300);
      $('#socializethis img').css('display', 'inline');
    });
    //leave
    $('#socializethis').bind('mouseleave',function(){
      $(this).animate({ opacity: .7}, 300);
    });
    // Click minimize
    $('#socializethis #minimize').click( function() {
      minshare();
      //$.cookie('minshare', '1');
    });

    //if($.cookie('minshare') == 1){
    //  minshare();
    //}

    function minshare(){
      $('#socializethis').animate({height:'15px', width: '40px', opacity: .7}, 300); 
      $('#socializethis img').css('display', 'none');
      return false;
    }
  };
})(jQuery);

function share_link(type) {
    var d = document.location.href;
    var inc = $("#incremental").attr("checked") ? 1 : 0;
    var current_url = d.substring(0, d.lastIndexOf('#'))+"#|"+main_lang()+"|"+encodeURI(article_name)+"|"+past_seconds+"|"+inc;

    var defaults = {
        version:    '2.0.1',
        login:      'sonetfbk',
        apiKey:     'R_5d1118463acdf1f012b6b78b7eccf9d7',
        history:    '0',
        longUrl:    current_url
    };
    console.log(current_url);
    // Build the URL to query
    var daurl = "http://api.bit.ly/shorten?"+
                "version="+defaults.version+
                "&longUrl="+escape(defaults.longUrl)+
                "&login="+defaults.login+
                "&apiKey="+defaults.apiKey+
                "&history="+defaults.history+
                "&format=json&callback=?";
    // Utilize the bit.ly API
    $.getJSON(daurl, function(data){
        var url = data.results[defaults.longUrl].shortUrl;
        var host = window.location.hostname;
        var title = $('title').text() + " - Having a trip in the history of \""
                    + article_name + "\" ";
        title = escape(title); //clean up unusual characters
        var share = {};
        share.twit = 'http://twitter.com/home?status='+title+'%20'+url;
        share.facebook = 'http://www.facebook.com/sharer.php?u='+url+'&t='+title;
        share.digg = 'http://digg.com/submit?phase=2&url='+url+'&amp;title='+title;
        share.stumbleupon = 'http://stumbleupon.com/submit?url='+url+'&amp;title='+title;
        share.buzz = 'http://www.google.com/reader/link?url='+url+'&amp;title='+title+'&amp;srcURL='+host;
        share.delicious = 'http://del.icio.us/post?url='+url+'&amp;title='+title;
        window.location.href = share[type];
    });
}

