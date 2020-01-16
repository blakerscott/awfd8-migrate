/**
* @PluginName: gotmap
*
* @Desc: Apply .gotmap class to parent container of .gmap for left and right content height match.
* @Use: new $.gotmap($('.gotmap'),{ callback: function() { Callback Function if needed } });
*
*/
(function($) {
	//Define the plugin's name here
	var __name = 'gotmap';
	//--
	$[__name] = function(el, options) {
	try {
		
		//-- Plugin gymnastics - Part 1/3
		//---------------------------------------------
		var self = this; // prevent from loosing the scope
		self.el = el = $(el); // store the passed element
		$(self.el).data(__name, self); // store the plugin instance into the element
		//---------------------------------------------
		
		
		//-- init
		//---------------------------------------------
		self.defaults = {};
		
		self.initialize = function() {
			self.options = $.extend({}, self.defaults, options); //merging defaults with passed arguments
			//-

			ignite();
			
		};

		//-- Start
		//---------------------------------------------
		function ignite() {
			//- Start maps

			self.el.each(function() {

				var nHeight = $(this).height();
				var eNode = $(this).find('.PageMap');

				console.log(eNode);

				if(eNode.length)
				new $.maps(eNode,{
					height: nHeight,
					callback: function() {
						
					}
				});
			});
		}
		//-
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