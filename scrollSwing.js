// scrollSwing plugin

function scrollSwing(prefix) {
 
  if (!(CSS.supports('position', 'sticky') || CSS.supports('position', '-webkit-sticky')) && !CSS.supports('--var', '0')) {
    return undefined;
  }
  
  var self = this;
  var swingStyles = document.createTextNode('[data-position-swing="top"],[data-position-swing="along"],[data-position-swing="bottom"]{position:-webkit-sticky;position:sticky;pointer-events:none;overflow:hidden;}[data-position-swing="top"],[data-position-swing="along"]{top:0;}[data-position-swing="bottom"]{bottom:0}[data-position-swing]>*{pointer-events:auto;will-change:transform;}[data-position-swing-scout]{visibility:hidden;display:block;height:0;margin:0;padding:0;border:0;}');
  var swingStylesTag = document.createElement('style');
  swingStylesTag.appendChild(swingStyles);
  document.head.appendChild(swingStylesTag);
  
  var swings = [];
  var scrolls = [];
  var swingCount = 0;
  var prefix = prefix || '--swing';
  
  function Swing(id,opts) {
    var isNode = (id instanceof Element);
    var isProp = (typeof id === 'string');
    
    if (!isNode && !isProp) {
      return false;
    }
    
    swings.push(this);
    swingCount++;
    
    this.key    = id;
    this.dom    = (isNode || false);
    this.prop   = (opts && opts.property && this.dom) ? opts.property : setProp(this);
    this.along  = (opts && opts.along && this.dom || false);
    this.bottom = (opts && opts.bottom && !this.along && this.dom || false);
    this.into   = (opts && opts.into && !this.along || false);
    this.offset = (opts && opts.offset && !this.along) ? opts.offset : 0;
    this.height = (opts && opts.height) ? parseInt(opts.height) : getHeight(this);
    this.scroll = (opts && opts.scroll) ? opts.scroll : getScroll(this.key);
    this.with   = (this.bottom && this.into || !this.bottom && !this.into);
    this.active = (this.dom) ? false : true;
    this.edges  = {start:0,end:0};
    this.pos    = 0;
    this.scout  = (this.dom) ? createScout(this) : undefined;
    
    setDataPosition(this);
    registerScroll(this);
    
    if (this.along) {
      this.key.style.setProperty('max-height',(returnScroll(this.scroll).port + 'px'));
    }
    if (this.dom) {
      this.key.children[0].style.transform = 'translateY(var(' + this.prop + '))';
    }
    document.documentElement.style.setProperty((this.prop + '-height'), (this.height + 'px'));
    setEdges(this, true);
  }
  
  function Scroll(el) {
    scrolls.push(this);
    this.key = el;
    this.value = 0;
    this.change = 0;
    
    var self = this;
    this.update = function() {
      var elScroll = (el === document) ? document.documentElement : el;
      self.port = (elScroll === document.documentElement) ? window.innerHeight : elScroll.clientHeight;
      self.height = elScroll.scrollHeight;
    }
    this.update();
    this.key.addEventListener('scroll', swingScrollEvent);
  }
  
  function registerScroll(swing) {
    if (!returnScroll(swing.scroll)) {
      var createScroll = new Scroll(swing.scroll);
    }
  }
  // tested raf, but behaved slightly worse in most browsers
  // with raf, used scout bounding diff instead of scroll diff
  function swingScrollEvent(e) {
    var el = e.target;
    var scroll = returnScroll(el);
    var elScroll = (el === document) ? (el.scrollingElement || el.documentElement) : el;
    var newScroll = Math.max(0, Math.min((scroll.height - scroll.port), elScroll.scrollTop));
    scroll.change = (newScroll - scroll.value);
    scroll.value = newScroll;
    
    swings.forEach(function(swing){
      // makes it so scrolls can be nested
      if (el !== swing.scroll) {
        return;
      }
      setEdges(swing);
    });
  }
  
  function setEdges(swing, force) {
    var start = 0;
    var end   = 0;
    if (!swing.dom) {
      start = returnScroll(swing.scroll).value - swing.offset;
      end = undefined;
    } else {
      var rectSwing = rect(swing.key);
      var rectParent = rect(swing.key.offsetParent);
      var rectScout = rect(swing.scout);
      if (swing.along) {
        start = Math.round(rectSwing.top) - Math.round(rectScout.top);
        end   = Math.round(rectParent.bottom) - Math.round(rectSwing.bottom);
      } else if (swing.bottom) {
        start = Math.round(rectScout.bottom) - Math.round(rectSwing.bottom);
        end   = Math.round(rectSwing.top) - Math.round(rectParent.top);
      } else {
        start = Math.round(rectSwing.top) - Math.round(rectScout.top);
        end   = Math.round(rectParent.bottom - Math.round(rectSwing.bottom));
      }
    }
    swing.edges.start = start;
    swing.edges.end = end;
    processSwing(swing, force);
  }
  
  function processSwing(swing, force) {
    var scroll = returnScroll(swing.scroll);
    
    if (scroll.change === 0 || swing.height === 0 || (swing.along && swing.height < scroll.port)) {
      if (!force) {
        return;
      }
    }
    
    var lastPosition = swing.pos;
    var swingChange = (swing.bottom) ? (scroll.change * -1) : scroll.change;
    
    if (swing.edges.start <= 0) {
      swing.pos = 0;
      swing.active = false;
      
      if (!swing.with) {
        swing.pos = swing.height;
      }
    } else if (swing.edges.end <= 0) {
      swing.pos = swing.height;
      swing.active = false;
      if (swing.along) {
        swing.pos = swing.height - scroll.port;
      }
    } else {
      if (!swing.active) {
        swing.active = true;
        swing.pos = Math.min(swing.height,swing.edges.start);
        if (swing.along && lastPosition !== 0) {
          // case for when after along edge and comes back into view
          swing.pos = swing.height - scroll.port - swing.edges.end;
        }
      } else {
        var maxSwing = (swing.along) ? (swing.height - scroll.port) : swing.height;
        swing.pos = Math.max(0,Math.min(maxSwing,(lastPosition + swingChange)));
      }
      if (!swing.with) {
        if (swing.edges.start <= swing.height) {
          if (swingChange > 0) {
            swing.pos = swing.height;
          } else {
            swing.pos = swing.height - swing.edges.start;
          }
        }
      }
    }
    
    if (swing.pos !== lastPosition || force) {
      setSwing(swing);
    }
  }
  
  function setSwing(swing) {
    var translate = swing.pos;
    
    if (swing.bottom) {
      if (swing.into) {
      } else {
        translate = swing.height - translate;
      }
    } else {
      if (swing.into) {
        translate = translate - swing.height;
      } else {
        translate *= -1;
      }
    }
    document.documentElement.style.setProperty(swing.prop, (translate + 'px'));
    var perc = 1 - (Math.abs(translate) / swing.height);
    document.documentElement.style.setProperty((swing.prop + '-perc'), perc);
  }
  
  function setDataPosition(swing){
    if (!swing.dom) {
      return;
    }
    var strPos;
    if (swing.along) {
      strPos = 'along'
    } else if (swing.bottom) {
      strPos = 'bottom'
    } else {
      strPos = 'top'
    }
    swing.key.dataset.positionSwing = strPos;
  }
  
  function setProp(swing) {
    if (!swing.dom) {
      return swing.key;
    } else {
      return prefix + '-' + swingCount;
    }
  }
  
  function createScout(swing) {
    var scout = document.createElement('span');
    scout.dataset.positionSwingScout = '';
    if (swing.bottom) {
      swing.key.parentNode.insertBefore(scout, swing.key.nextSibling);
    } else {
      swing.key.parentNode.insertBefore(scout, swing.key);
    }
    return scout;
  }
  
  function removeScout(swing) {
    if (swing.scout) {
      swing.scout.parentNode.removeChild(swing.scout);
    }
  }

  function getScroll(el) {
    if (!el.tagName) {
      return document;
    }
    var parent = el.parentElement;
    var regex = /(auto|scroll|overlay)/;
    if (el === document.documentElement) {
      return document;
    } else if ((parent.scrollHeight > parent.clientHeight) && regex.test(window.getComputedStyle(parent).overflowY)) {
      // for when html {overflow-x:hidden}
      if (parent === document.documentElement) {
        return document;
      } else {
        return parent;
      }
    } else {
      return getScroll(parent);
    }
  }
  
  function rect(el) {
    return el.getBoundingClientRect();
  }
  
  function returnScroll(el) {
    return scrolls.find(function(scroll){
      return scroll.key === el;
    });
  }
  
  function returnSwing(id) {
    return swings.find(function(swing){
      return swing.key === id;
    });
  }
  
  function getHeight(swing) {
    if (!swing.dom) {
      return swing.height;
    }
    if (swing.along) {
      return swing.key.children[0].offsetHeight;
    }
    return swing.key.offsetHeight - swing.offset;
  }
  
  function removeScroll(swing) {
    var canRemoveScroll = true;
    var currentSwing = swing;
    var currentScroll = swing.scroll;
    var index = swings.indexOf(swing);
    swings.forEach(function(swing){
      if (swing.scroll === currentScroll && swing !== currentSwing) {
        canRemoveScroll = false;
      }
    });
    var indexOfScroll = scrolls.indexOf(returnScroll(currentScroll));
    if (canRemoveScroll && indexOfScroll !== -1) {
      scrolls.splice(indexOfScroll, 1);
      swing.scroll.removeEventListener('scroll', swingScrollEvent);
    }
  }
  
  self.add = function(id,opts) {
    if (NodeList.prototype.isPrototypeOf(id)) {
      id.forEach(function(node){
        var newSwing = new Swing(node,opts);
      });
      return;
    }
    var newSwing = new Swing(id,opts);
  }
  
  self.remove = function(id, all) {
    if (NodeList.prototype.isPrototypeOf(id)) {
      id.forEach(function(node){
        self.remove(node);
      });
      return;
    }
    
    var swing = (id instanceof Swing) ? id : returnSwing(id);
    var index = swings.indexOf(swing);
    if (index < 0) {
      return;
    }
    
    removeScroll(swing);

    document.documentElement.style.removeProperty(swing.prop);
    document.documentElement.style.removeProperty(swing.prop + '-height');
    document.documentElement.style.removeProperty(swing.prop + '-perc');
    removeScout(swing);
    if (swing.dom) {
      delete swing.key.dataset.positionSwing;
      swing.key.children[0].style.transform = '';
    }
    if (swing.along) {
      swing.key.style.removeProperty('max-height');
    }
    swings.splice(index, 1);
  }
  
  self.update = function(id) {
    if (NodeList.prototype.isPrototypeOf(id)) {
      id.forEach(function(node){
        self.update(node);
      });
      return;
    }
    var swing = (id instanceof Swing) ? id : returnSwing(id);
    swing.height = getHeight(swing);
    if (swing.dom) {
      var scroll = swing.scroll;
      var newScroll = getScroll(swing.key);
      if (scroll !== newScroll) {
        removeScroll(swing);
        swing.scroll = newScroll;
        registerScroll(swing);
      }
    }
    document.documentElement.style.setProperty((swing.prop + '-height'), (swing.height + 'px'));
    if (swing.along) {
      var scroll= returnScroll(swing.scroll);
      scroll.update();
      swing.key.style.setProperty('max-height',(scroll.port + 'px'));
    }
    setEdges(swing, true);
  }
  
  self.updateAll = function() {
    swings.forEach(self.update);
  }
  
  self.removeAll = function() {
    while(swings.length > 0) {
      self.remove(swings[0], true);
    }
  }
}

// previous logic for along used pos:rel and current top offset
// then sticky top/bot when meeting edges with scouts
// could put this back in, which is better for painting
// for now just uniformally uses transform of inner node


// custom properties output for each swing position...
// - '--{prefix}-key' - current swing translation [+/-px]
// - '--{prefix}-key-perc' - percent the way through the swing [0-1]
// - '--{prefix}-key-height' - height of swing value [px]

// note that using the update methods, doesn't set new values for
// options on those elements, it just updates the position
// based upon documents state without analyzing on scroll

