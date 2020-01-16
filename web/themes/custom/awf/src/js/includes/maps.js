(function($) {
	//Define the plugin's name here
	var __name = 'maps';

	$[__name] = function(el, options) {

		try {

		//-- Plugin gymnastics - Part 1/3
		//---------------------------------------------
		var self = this; // prevent from loosing the scope
		self.el = el = $(el); // store the passed element
		$(self.el).data(__name, self); // store the plugin instance into the element
		//---------------------------------------------
		
		//-- init
		//----------------------------------------------

		var pMapOptions = {
			style: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
			defaults: {
				maxZoom: 19,
    		// zoomSnap: 2,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
			},
			geoStyles: {
				fillColor: '#e97200',
				fillOpacity: 0.35,
				color: '#e97200',
				weight: 2
			},
			ele: 'PageMap',
			mapCenter: [-0.7909904981540058, 17.841796875]
		}
		
		self.initialize = function() {
			self.options = $.extend({}, self.defaults, options); //merging defaults with passed arguments
			ignite();
		};
		
		//-- Vars
		//---------------------------------------------
		var aCoords = {},
		sFillClass = 'fill',
		nDefaultZoom,
		aInitCoords,
		pMap,
		pMapGeoJ;
		
		//-- Start
		//---------------------------------------------
		function ignite(){
			loadPageMap();
		}

		//-- Events
		//---------------------------------------------
				
		function bindEvents(){
			self.options.callback();
		}
		
		function staticMap() {
			//- Get static img
			var sImgSrc = self.el.attr('data-static');
			//- Append
			self.el
			.append(
				$('<img/>').attr('src',sImgSrc)
			)
			.removeClass('PageMap');
		}

		function loadPageMap() {

			var sCoords, aCoords, nAttrZoom, sGeoData, nMaxInitZoom;

			//- Stretch height of map to fit content (if has class .fill)
			adjustHeight();

			if(_.isUndefined(L) || hasMap()) return;
			if(_.isUndefined(L.map)) return;

			pMap = L.map(pMapOptions.ele, pMapOptions.defaults).setView(pMapOptions.mapCenter, 2.5);
			pMapGeoJ = new L.geoJson();

			L.tileLayer(pMapOptions.style, pMapOptions.defaults).addTo(pMap);
			pMapGeoJ.addTo(pMap);

			$.ajax({
			dataType: "json",
			url: $('#'+pMapOptions.ele).attr('data-GeoData'),
			success: function(data) {
		    $(data.features).each(function(key, data) {
		        pMapGeoJ.addData(data);
		        pMapGeoJ.setStyle(pMapOptions.geoStyles);
		    });
			}
			}).error(function() {});

			bindEvents();
		}

		function hasMap() {
			return self.el.find('div').length > 2 || false;
		}

		function adjustHeight() {
			!_.isNull(self.options.height) && self.el.hasClass(sFillClass) ? self.el.css('height',self.options.height + 'px') : '';
		}

		var kill = self.kill = function(callback) {
			self.el.find('div:first').transition({
				'opacity': 0
			}, self.options.animTime, self.options.animFX, function() {
				pMap = null;
				$(this).remove();
				_.isUndefined(callback) || callback();
			});
		}
		//---------------------------------------------
		//-- Plugin gymnastics - Part 2/3
		//---------------------------------------------
		self.initialize();
	}
	catch(e) {
		dumpError(e);
	};
	}
	//-- Plugin gymnastics - Part 3/3
	//---------------------------------------------
	$.pluginMutator(__name);
})(jQuery);