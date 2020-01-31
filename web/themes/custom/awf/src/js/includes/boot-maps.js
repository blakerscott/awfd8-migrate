if (typeof $ == 'undefined') var $ = jQuery;

(function () {
  'use strict';

  $(document).ready(function () {

    //- Start maps
    var eNode = $('.gotmap');
    !eNode.length || new $.gotmap(eNode, {});

  });

})();
