/* Plugin Mutator */

(function(a){a.pluginMutator=function(b){a.fn[b]=function(c){var d=arguments;return this.each(function(e,f){var g=a(this).data(b);if(c){if(a.type(c)=="string"){if(!g)g=new a[b](f);if(!g[c])throw"> function '"+c+"' doesn't exist in plugin '"+b+"'";d=Array.prototype.slice.call(d,1);g[c].apply(g,d)}else{g=new a[b](f,c)}}else{if(!g)g=new a[b](f,c)}})}}})(jQuery);

