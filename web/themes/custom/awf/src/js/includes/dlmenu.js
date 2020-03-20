(function($) {

  $('.menu').on('mouseenter focus', '.menu-item--expanded > a', function(e) {
    var el = $(this);
    el.toggleClass('has-focus');
    // Show sub-menu
    el.parents('.menu-item').attr('aria-expanded', 'true');
  }).on('mouseleave blur', '.menu-item--expanded > a', function(e) {
    var el = $(this);
    el.toggleClass('has-focus');
    // Only hide sub-menu after a short delay, so links get a chance to catch focus from tabbing
    setTimeout(function() {
      if (el.siblings('li.menu-item > .menu').attr('data-has-focus') !== 'true') {
        el.parents('li.menu-item').attr('aria-expanded', 'false');
      }
    }, 100);
  }).on('mouseenter focusin', 'li.menu-item > .menu', function(e) {
    var el = $(this);
    el.attr('data-has-focus', 'true');
  }).on('mouseleave focusout', 'li.menu-item > .menu', function(e) {
    var el = $(this);
    setTimeout(function() {
      // Check if anything else has picked up focus (i.e. next link in sub-menu)
      if (el.find(':focus').length === 0) {
        el.attr('data-has-focus', 'false');
        // Hide sub-menu on the way out if parent link doesn't have focus now
        if (el.siblings('li.menu-item a.has-focus').length === 0) {
          el.parents('.menu-item--expanded').attr('aria-expanded', 'false');
        }
      }
    }, 100);
  });

  $('a[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: target.offset().top
        }, 1000);
        return false;
      }
    }
  });

  /*!
   * hoverIntent v1.8.1 // 2014.08.11 // jQuery v1.9.1+
   * http://briancherne.github.io/jquery-hoverIntent/
   *
   * You may use hoverIntent under the terms of the MIT license. Basically that
   * means you are free to use hoverIntent as long as this header is left intact.
   * Copyright 2007, 2014 Brian Cherne
   */

  /* hoverIntent is similar to jQuery's built-in "hover" method except that
   * instead of firing the handlerIn function immediately, hoverIntent checks
   * to see if the user's mouse has slowed down (beneath the sensitivity
   * threshold) before firing the event. The handlerOut function is only
   * called after a matching handlerIn.
   *
   * // basic usage ... just like .hover()
   * .hoverIntent( handlerIn, handlerOut )
   * .hoverIntent( handlerInOut )
   *
   * // basic usage ... with event delegation!
   * .hoverIntent( handlerIn, handlerOut, selector )
   * .hoverIntent( handlerInOut, selector )
   *
   * // using a basic configuration object
   * .hoverIntent( config )
   *
   * @param  handlerIn   function OR configuration object
   * @param  handlerOut  function OR selector for delegation OR undefined
   * @param  selector    selector OR undefined
   * @author Brian Cherne <brian(at)cherne(dot)net>
   */

  (function(factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
      define(['jquery'], factory);
    } else if (jQuery && !jQuery.fn.hoverIntent) {
      factory(jQuery);
    }
  })(function($) {
    'use strict';

    // default configuration values
    var _cfg = {
      interval: 100,
      sensitivity: 6,
      timeout: 0
    };

    // counter used to generate an ID for each instance
    var INSTANCE_COUNT = 0;

    // current X and Y position of mouse, updated during mousemove tracking (shared across instances)
    var cX, cY;

    // saves the current pointer position coordinates based on the given mousemove event
    var track = function(ev) {
      cX = ev.pageX;
      cY = ev.pageY;
    };

    // compares current and previous mouse positions
    var compare = function(ev, $el, s, cfg) {
      // compare mouse positions to see if pointer has slowed enough to trigger `over` function
      if (Math.sqrt((s.pX - cX) * (s.pX - cX) + (s.pY - cY) * (s.pY - cY)) < cfg.sensitivity) {
        $el.off(s.event, track);
        delete s.timeoutId;
        // set hoverIntent state as active for this element (permits `out` handler to trigger)
        s.isActive = true;
        // overwrite old mouseenter event coordinates with most recent pointer position
        ev.pageX = cX;
        ev.pageY = cY;
        // clear coordinate data from state object
        delete s.pX;
        delete s.pY;
        return cfg.over.apply($el[0], [ev]);
      } else {
        // set previous coordinates for next comparison
        s.pX = cX;
        s.pY = cY;
        // use self-calling timeout, guarantees intervals are spaced out properly (avoids JavaScript timer bugs)
        s.timeoutId = setTimeout(function() { compare(ev, $el, s, cfg); }, cfg.interval);
      }
    };

    // triggers given `out` function at configured `timeout` after a mouseleave and clears state
    var delay = function(ev, $el, s, out) {
      delete $el.data('hoverIntent')[s.id];
      return out.apply($el[0], [ev]);
    };

    $.fn.hoverIntent = function(handlerIn, handlerOut, selector) {
      // instance ID, used as a key to store and retrieve state information on an element
      var instanceId = INSTANCE_COUNT++;

      // extend the default configuration and parse parameters
      var cfg = $.extend({}, _cfg);
      if ($.isPlainObject(handlerIn)) {
        cfg = $.extend(cfg, handlerIn);
        if (!$.isFunction(cfg.out)) {
          cfg.out = cfg.over;
        }
      } else if ($.isFunction(handlerOut)) {
        cfg = $.extend(cfg, { over: handlerIn, out: handlerOut, selector: selector });
      } else {
        cfg = $.extend(cfg, { over: handlerIn, out: handlerIn, selector: handlerOut });
      }

      // A private function for handling mouse 'hovering'
      var handleHover = function(e) {
        // cloned event to pass to handlers (copy required for event object to be passed in IE)
        var ev = $.extend({}, e);

        // the current target of the mouse event, wrapped in a jQuery object
        var $el = $(this);

        // read hoverIntent data from element (or initialize if not present)
        var hoverIntentData = $el.data('hoverIntent');
        if (!hoverIntentData) { $el.data('hoverIntent', (hoverIntentData = {})); }

        // read per-instance state from element (or initialize if not present)
        var state = hoverIntentData[instanceId];
        if (!state) { hoverIntentData[instanceId] = state = { id: instanceId }; }

        // state properties:
        // id = instance ID, used to clean up data
        // timeoutId = timeout ID, reused for tracking mouse position and delaying "out" handler
        // isActive = plugin state, true after `over` is called just until `out` is called
        // pX, pY = previously-measured pointer coordinates, updated at each polling interval
        // event = string representing the namespaced event used for mouse tracking

        // clear any existing timeout
        if (state.timeoutId) { state.timeoutId = clearTimeout(state.timeoutId); }

        // namespaced event used to register and unregister mousemove tracking
        var mousemove = state.event = 'mousemove.hoverIntent.hoverIntent' + instanceId;

        // handle the event, based on its type
        if (e.type === 'mouseenter') {
          // do nothing if already active
          if (state.isActive) { return; }
          // set "previous" X and Y position based on initial entry point
          state.pX = ev.pageX;
          state.pY = ev.pageY;
          // update "current" X and Y position based on mousemove
          $el.off(mousemove, track).on(mousemove, track);
          // start polling interval (self-calling timeout) to compare mouse coordinates over time
          state.timeoutId = setTimeout(function() { compare(ev, $el, state, cfg); }, cfg.interval);
        } else { // "mouseleave"
          // do nothing if not already active
          if (!state.isActive) { return; }
          // unbind expensive mousemove event
          $el.off(mousemove, track);
          // if hoverIntent state is true, then call the mouseOut function after the specified delay
          state.timeoutId = setTimeout(function() { delay(ev, $el, state, cfg.out); }, cfg.timeout);
        }
      };

      // listen for mouseenter and mouseleave
      return this.on({ 'mouseenter.hoverIntent': handleHover, 'mouseleave.hoverIntent': handleHover }, cfg.selector);
    };
  });

  function awfMobileMenuParts() {
    // $('#block-mainmenu li.menu-item--expanded').append('<a class="sub-nav-toggle"><span class="element-invisible">Open Sub-navigation</span></a>');
    $('<a class="sub-nav-toggle"><span class="element-invisible">Open Sub-navigation</span></a>').insertAfter('#block-mainmenu li.menu-item--expanded > a.menu-link');
    $('#block-mainmenu li.menu-item--expanded > .menu').prepend('<a class="sub-nav-toggle-back">' + 'Back' + '</a>');
  }

  var windowOffset = 0;
  var menutoggle = $('.menu-toggle');
  var menublock = $('#block-mainmenu');
  var headergroup = $('.region-header');
  var headerSection = $('.header-section');
  var header = $('#header');
  var framework = $('html, body');

  // search section
  var searchSection = $('.search-block-form');
  var searchContent = $('.search-content');
  searchContent.addClass('headerItems');

  function awfMobileMenu() {

    var isMobile = menutoggle.is(':visible');
    var subnavtoggle = $('.sub-nav-toggle');
    var subnavtoggleback = $('.sub-nav-toggle-back');
    var menuExpandedlink = $('#block-mainmenu .menu li.menu-item.menu-item--expanded a.menu-link');
    var menulink = $('#block-mainmenu .menu li.menu-item .menu-link');
    // var subnav = $('#block-mainmenu .menu li.menu-item--expanded .menu');
    var subNavBack = $('a.sub-nav-toggle-back');
    subNavBack.text($(this).parent().parent().find('a.menu-link:first-child').text());

    if (isMobile) {
      menublock.addClass('mobile-menu');
      headergroup.addClass('mobile');
      menuExpandedlink.addClass('expanded-link');

      // Add in click open on the main nav with accessibility
      menutoggle.off('click keyup').on('click keyup', function() {
        if (menutoggle.hasClass('open')) {
          hideHeaderNavs();
        } else {
          headergroup.addClass('open').attr('aria-expanded', 'true');
          menutoggle.addClass('open').attr('aria-expanded', 'true');
          menublock.addClass('open').attr('aria-expanded', 'true');
          header.addClass('stay-open stay-open-menu');
          framework.addClass('open-menu');
          headerSection.addClass('fixed');
          windowOffset = $(window).scrollTop();
        }
      });

      subnavtoggle.off('click keyup').on('click keyup', function() {
        if ($(this).hasClass('open')) {
          $(this).removeClass('open');
          $(this).siblings('.menu-link.expanded-link').removeClass('sheep');
          $(this).siblings('.menu').removeClass('open').attr('aria-expanded', 'false');
          $(this).closest('.menu').removeClass('subnav');
        } else {
          subnavtoggleback.addClass('open');
          $('.menu-link.expanded-link').removeClass('previous-link');
          $(this).siblings('.menu-link.expanded-link').addClass('previous-link');
          subnavtoggleback.text($('.menu-link.expanded-link.previous-link').text());
          $(this).addClass('open');
          $(this).siblings('.menu').addClass('open').attr('aria-expanded', 'true');
          $(this).closest('.menu').addClass('subnav');
          $(this).addClass('SHIT');
        }
      });

      subnavtoggleback.off('click keyup').on('click keyup', function() {
        $('.menu-link.expanded-link').removeClass('previous-link');
        subnavtoggleback.text($(this).parent().parent().parent().siblings('a.menu-link.expanded-link').text());
        $(this).removeClass('open');
        $(this).parent().removeClass('open');
        $(this).parent().siblings(subnavtoggle).removeClass('open').attr('aria-expanded', 'false');
        $(this).closest('.subnav').removeClass('subnav');
      });
    } else {
      // $(window).scrollTop(windowOffset);
      headergroup.removeClass('open mobile').attr('aria-expanded', '');
      menutoggle.removeClass('open').attr('aria-expanded', '');

      menublock.removeClass('open mobile-menu').attr('aria-expanded', '');
      header.removeClass('stay-open stay-open-menu');
      framework.removeClass('open-menu');
      // menuset.removeClass('subnav');
      subnavtoggle.removeClass('open').siblings('.menu').attr('aria-expanded', '').removeClass('open').closest('.menu').removeClass('subnav');
    }

    menulink.on('focus', function() {
      $(this).parents('.menu-item').addClass('open');
    });
    menulink.on('blur', function() {
      $(this).parents('.menu-item').removeClass('open');
    });

  }

  function hideHeaderNavs() {
    headergroup.removeClass('open').attr('aria-expanded', 'false');
    menutoggle.removeClass('open').attr('aria-expanded', 'false');
    menublock.removeClass('open').attr('aria-expanded', 'false');
    header.removeClass('stay-open stay-open-menu');
    framework.removeClass('open-menu');
    var isMobile = menutoggle.is(':visible');
    if (!isMobile) {
      $('nav.navigation.menu--main-menu > ul.menu > li.menu-item').removeClass('is-open');
    }
  };

  //search button
  $('#search-toggle').on('click', function(e) {
    searchSection.toggleClass('is-open');
    hideHeaderNavs();
    searchSection.parent('.toggle-class').toggleClass('toggle-class');
    !searchSection.hasClass('is-open') || searchSection.find('input[type="text"]').focus();

    return false;
  });

  function closeAllHeaderItems() {
    hideHeaderNavs();
    $('.search-block-form.open').removeClass('open');

    var isMobile = menutoggle.is(':visible');
    if (!isMobile) {
      searchSection.removeClass('is-open');

    }
  };

  var headerNavs = $('nav.navigation.menu--main-menu > ul.menu > li.menu-item.menu-item--expanded > a');

  headerNavs.on('click', function(e) {
    e.preventDefault();
    searchSection.removeClass('is-open');
    closeAllHeaderItems();
    $(this).parent('li.menu-item.menu-item--expanded').toggleClass('is-open');
  });

  //add fixed white background
  function updatePos() {
    var scroll = $(window).scrollTop();
    if (scroll > 10) {
      headerSection.addClass('fixed');
    } else {
      headerSection.removeClass('fixed');
    }
  };

  $(document).on('click', function(e) {
    var isMobile = menutoggle.is(':visible');
    if (isMobile) {
      // remove all the click listening by checking if it has toggle-class
      if ($(e.target).parents().hasClass('mobile-menu') || $(e.target).hasClass('mobile-menu') || $(e.target).hasClass('menu-toggle')) {} else {
        closeAllHeaderItems();
      }
    } else {
      if ($(e.target).parents().hasClass('is-open') || $(e.target).hasClass('is-open')) {} else {
        closeAllHeaderItems();
      }

    }
  });

  $(window).scroll(function() {
    var distanceFromTop = $(this).scrollTop();
    if (distanceFromTop >= $('.region-preface').height()) {
      $('.menu-container').addClass('sticky-nav');
    } else {
      $('.menu-container').removeClass('sticky-nav');
    }
  });

  $(document).scroll(updatePos);
  $(document).ready(awfMobileMenuParts);
  $(document).ready(awfMobileMenu);
  $(window).resize(awfMobileMenu);


}(jQuery));
