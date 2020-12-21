var GOOGLE_KEY = 'AIzaSyBEbWGcg6t8-Kawwdis1xqcFcxdDc5zv7g';

var g_map;
var g_markers = {};
var g_infoWindows = [];
var g_clicked_marker_index = 0; // 実際は1から使用される

$(function() {
  var zoom = 15;

  var params = getQuery();
  if (params["lat"] && params["lng"]) {
    var center = new google.maps.LatLng(parseFloat(params["lat"]), parseFloat(params["lng"]));
  } else if (location.hash != '') {
    var a = location.hash.substr(1).split(',');
    var center = new google.maps.LatLng(parseFloat(a[0]), parseFloat(a[1]));
    if (a.length >= 3 && parseInt(a[2]) > 0) {
      zoom = parseInt(a[2]);
    }
  } else {
    var center = new google.maps.LatLng(35.6813095277778, 139.76723425);
  }
  var gmap_options = {
    zoom: zoom,
    center: center,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    scaleControl: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  };
  g_map = new google.maps.Map(document.getElementById("gmap"), gmap_options);

  function onViewChanged() {
    var center = g_map.getCenter();
    location.hash = round(center.lat()) + ',' + round(center.lng()) + ',' + g_map.getZoom();
  }

  g_map.addListener('center_changed', onViewChanged);
  g_map.addListener('zoom_changed', onViewChanged);

  g_map.addListener('click', function (e) {
    appendToClickedLatLng(e.latLng);
    $('#distance_latlng1').val(formatLatLng(e.latLng));
    calculateDistance();
    g_clicked_marker_index += 1;
    var marker = addMarker("clicked:" + g_clicked_marker_index, e.latLng, {title: "[" + g_clicked_marker_index + "] " + formatLatLng(e.latLng), openInfoWindow: true});
    var $radius = $('#radius');
    if ($radius.val() != '0') {
      drawCircle(e.latLng, parseInt($radius.val()));
    }
  });
  g_map.addListener('rightclick', function (e) {
    appendToClickedLatLng(e.latLng);
    $('#distance_latlng2').val(formatLatLng(e.latLng));
    calculateDistance();
    g_clicked_marker_index += 1;
    var marker = addMarker("clicked:" + g_clicked_marker_index, e.latLng, {title: "[" + g_clicked_marker_index + "] " + formatLatLng(e.latLng), openInfoWindow: true});
  });

  console.log("bounds", g_map.getBounds());

  g_map.addListener('dragend', function() {
    var bounds = g_map.getBounds();
    var offsetx = 200;
    var offsety = 0;

    var point1 = g_map.getProjection().fromLatLngToPoint(bounds.getSouthWest());

    var point2 = new google.maps.Point(offsetx / Math.pow(2, g_map.getZoom()), offsety / Math.pow(2, g_map.getZoom()));

    var newPoint = g_map.getProjection().fromPointToLatLng(new google.maps.Point( point1.x - point2.x, point1.y + point2.y));

    bounds.extend(newPoint);
    updateCenter();
  });


  $('#map_types').change(function() {
    var $this = $(this);
    var mapTypeId = $this.val();
    g_map.setMapTypeId(mapTypeId);
  });

  $('#distance_latlng1').change(calculateDistance);
  $('#distance_latlng2').change(calculateDistance);

  $('#address').keydown(function(e) {
    var $this = $(this);
    if (e.keyCode == 13) {
      geocode($this.val(), function(latlng) {
        $('#center_latlng').val(latlng.lat + ',' + latlng.lng);
        g_map.setCenter(latlng);
        addMarker("address", latlng, {color: "purple"});
      });
    }
  });

  updateCenter();
});

function calculateDistance() {
  var latlng1 = parseLatLng($('#distance_latlng1').val());
  var latlng2 = parseLatLng($('#distance_latlng2').val());
  if (!latlng1) {
    $('#distance').val('latlng1 is not valid');
    return;
  }
  if (!latlng2) {
    $('#distance').val('latlng2 is not valid');
    console.log($('#distance_latlng2').val());
    return;
  }
  var d = distVincenty(latlng1.lat(), latlng1.lng(), latlng2.lat(), latlng2.lng());
  $('#distance').val(d);
}

function updateCenter() {
  var center = g_map.getCenter();
  $('#center_latlng').val(formatLatLng(center));
}

function setPastedMarkers() {
  var index = 0;
  var text = $('#pasted_latlngs').val();
  var lines = text.split("\n");
  var last_latlng = null;
  lines.forEach(function(line) {
    var latlng = parseLatLng(line);
    if (latlng == null)
      return;
    index += 1;
    var marker = addMarker("pasted:" + index, latlng, {title: "[" + index + "] " + formatLatLng(latlng), color: "purple", openInfoWindow: true});

    last_latlng = latlng;
  });
  if (last_latlng) {
    g_map.setCenter(last_latlng);
  }
}

function parseLatLngTextArea() {
  var text = $('#pasted_latlngs').val();
  var lines = text.split("\n");
  var last_latlng = null;
  var resultLines = "";
  lines.forEach(function(line, index) {
    if (line.trim() != "") {
      var latLng = parseLatLng(line);
      if (latLng == null) {
        var resultLine = "Parse Error: " + line + "\n";
      } else {
        var resultLine = latLng.lat() + "," + latLng.lng() + "," + (index + 1) + "\n";
      }
      resultLines += resultLine;
    }
  });
  $('#pasted_latlngs').val(resultLines);
}

function formatFloat(f) {
  return f.toFixed(7);
}

function formatLatLng(latlng) {
  return formatFloat(latlng.lat()) + "," + formatFloat(latlng.lng());
}

function parseLatLng(str) {
  var m = str.match(/([0-9.+-]+)[^0-9.+-]+([0-9.+-]+)/);
  if (m == null) {
    return null;
  }
  if ($('#latLngOrder').val() == 'latLng') {
    var lat = parseFloat(m[1]);
    var lng = parseFloat(m[2]);
  } else {
    var lat = parseFloat(m[2]);
    var lng = parseFloat(m[1]);
  }
  // 緯度経度が逆の場合に対応（ただし日本が前提）
  if (lat > lng && 30 < lng && lng < 50 && 120 < lat && lat < 150) {
    var tmp = lat;
    lat = lng;
    lng = tmp;
  }
  var latlng = new google.maps.LatLng(lat, lng);
  return latlng;
}

function appendToClickedLatLng(latlng) {
  $ta = $('#clicked_latlngs');
  $ta.text($ta.text() + formatLatLng(latlng) + (g_clicked_marker_index + 1) + "\n");
}

function addMarker(key, latlng, options) {
  if (typeof(g_markers[key]) != "undefined") {
    g_markers[key].setMap(null);
  }
  options = options || {};
  // blue | red | purple | yellow | green
  options.color = options.color || "yellow";
  options.title = options.title || "";
  var marker = new google.maps.Marker({
    position: latlng,
    map: g_map,
    icon: "http://maps.google.com/mapfiles/ms/icons/" + options.color + "-dot.png",  // アイコンのリスト： http://stackoverflow.com/a/18623391/5209556
    title: options.title,
    zIndex: 999980
  });
  g_markers[key] = marker;
  var infowindow = new google.maps.InfoWindow({
    content: options.title
  });
  infowindow.marker = marker;
  g_infoWindows.push(infowindow);
  marker.addListener("click", function() {
    infowindow.open(g_map, marker);
  });
  if (options.openInfoWindow) {
    infowindow.open(g_map, marker);
  }
  return marker;
}

function setCenter() {
  var $this = $('#center_latlng');
  var latlng = parseLatLng($this.val());
  if (latlng) {
    g_map.setCenter(latlng);
  }
}

function getQuery() {
  if(window.location.search === "") return {};
  const variables = window.location.search.split("?")[1].split("&");
  const obj = {};
  variables.forEach(function(v, i) {
    const variable = v.split("=");
    obj[variable[0]] = Number(variable[1]);
  });
  return obj;
}

function distVincenty(lat1, lon1, lat2, lon2) {
  function toRad(a) {
      return a / 180.0 * Math.PI;
  }

  var a = 6378137, b = 6356752.3142,  f = 1/298.257223563;  // WGS-84 ellipsiod
  var L = toRad((lon2-lon1));
  var U1 = Math.atan((1-f) * Math.tan(toRad(lat1)));
  var U2 = Math.atan((1-f) * Math.tan(toRad(lat2)));
  var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  var lambda = L, lambdaP = 2*Math.PI;
  var iterLimit = 20;
  while (Math.abs(lambda-lambdaP) > 1e-12 && --iterLimit>0) {
    var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    var sinSigma = Math.sqrt((cosU2*sinLambda) * (cosU2*sinLambda) + 
      (cosU1*sinU2-sinU1*cosU2*cosLambda) * (cosU1*sinU2-sinU1*cosU2*cosLambda));
    if (sinSigma==0) return 0;  // co-incident points
    var cosSigma = sinU1*sinU2 + cosU1*cosU2*cosLambda;
    var sigma = Math.atan2(sinSigma, cosSigma);
    var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    var cosSqAlpha = 1 - sinAlpha*sinAlpha;
    var cos2SigmaM = cosSigma - 2*sinU1*sinU2/cosSqAlpha;
    if (isNaN(cos2SigmaM)) cos2SigmaM = 0;  // equatorial line: cosSqAlpha=0 (§6)
    var C = f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1-C) * f * sinAlpha *
      (sigma + C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));
  }
  if (iterLimit==0) return NaN  // formula failed to converge

  var uSq = cosSqAlpha * (a*a - b*b) / (b*b);
  var A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
  var B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
  var deltaSigma = B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-
    B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));
  var s = b*A*(sigma-deltaSigma);

  s = s.toFixed(3); // round to 1mm precision
  return s;
}

function decode_path_onclick() {
  var encodedPath = $('#decode_path').val();
  var path = google.maps.geometry.encoding.decodePath(encodedPath);
  if (path.length > 1) {
    new google.maps.Polyline({
      map: g_map,
      path: path,
      strokeColor: '#ff0000',
      fillColor: '#ff0000',
    });
    g_map.setCenter({ lat: (path[0].lat() + path[path.length - 1].lat()) / 2, lng: (path[0].lng() + path[path.length - 1].lng()) / 2 });
  }
}

function geocode(address, callback) {
  var params = {
    address: address,
    key: GOOGLE_KEY,
  };
  $.getJSON('https://maps.googleapis.com/maps/api/geocode/json', params)
    .then(function(res) {
      try {
        var latlng = res.results[0].geometry.location;
        callback(latlng);
      } catch (err) {
      }
    });
}

function drawCircle(center, radius) {
  var circle = new google.maps.Circle({
    strokeColor: '#FF0000',
    strokeOpacity: 0.7,
    strokeWeight: 1,
    fillColor: '#FF0000',
    fillOpacity: 0.15,
    map: g_map,
    center: center,
    radius: radius,
    clickable: false,
  });
}

function round(num, digitsAfterDot) {
    digitsAfterDot = digitsAfterDot || 6;
    var pow = Math.pow(10, digitsAfterDot);
    return Math.floor(num * pow) / pow;
}

function openInfoWindows(isOpen) {
  g_infoWindows.forEach(function(infoWindow) {
    if (isOpen) {
      infoWindow.open(g_map, infoWindow.marker);
    } else {
      infoWindow.close();
    }
  });
}
