import './index.less'
import Marked from 'marked'
// import highlightjs from 'highlightjs'
// import VideoJs from 'video.js'

// require('video.js/dist/video-js.css')

const LAZY_LOAD_SPEC = 'js-md-lazy-load'
const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

class MarkdownParser {
  /**
   * @param opts {object}
   * @param opts.headingRender {function}
   * @param opts.renderImageError {function}
   * @param opts.tocRender {function}
   * @param opts.container {string|DOMElement}
   */
  constructor(opts) {
    opts = opts || {}
    opts = Object.assign({
      showToc: true,
      stickyToc: true,
      contentClass: 'markdown-body-content'
    }, opts)
    var container = opts.container;

    if (container) {
      container = (typeof container === 'string') ? document.querySelector(container) : container;
    } else {
      container = document.body;
    }
    opts.container = container
    this._opts = opts
    this._initRendered();
  }

  _initRendered() {
    var renderer = new Marked.Renderer()
    var $con = this._opts.container
    Marked.setOptions({
      renderer: renderer,
      // highlight: function (code) {
      //   return highlightjs.highlightAuto(code).value;
      // },
      pedantic: false,
      gfm: true,
      tables: true,
      breaks: false,
      sanitize: false,
      smartLists: true,
      smartypants: false,
      xhtml: false
    })

    var frag = document.createElement('div')
    frag.innerHTML = `<div class="js-md-main-content ${this._opts.contentClass}"></div><div class="js-md-toc-wrap"></div>`
    $con.appendChild(frag)

    this._$md = $con.querySelector('.js-md-main-content')
    this._$toc = $con.querySelector('.js-md-toc-wrap')

    this._renderer = renderer
    this.setHeadingHandler(renderer)
    this.setImageHandler(renderer)
    this.createlazyLoader()
  }

  createlazyLoader() {
    var $con = this._opts.container
    var self = this;


    var observer = new IntersectionObserver(
      function (changes) {
        changes.forEach(function (change) {
          if (change.intersectionRatio <= 0) {
            return;
          }
          var $img = change.target;
          var src = $img.dataset.src;
          delete $img.dataset.src
          if (src) {
            self.loadFreelogResource(src, function (fn) {
              fn($img)
            })
          }
          observer.unobserve($img);
        });
      }
    );

    var scrollHandler = (function () {
      var raf;
      return function () {
        raf = requestAnimationFrame(function () {
          var $imgs = $con.querySelectorAll(`.${LAZY_LOAD_SPEC}`)
          if ($imgs && $imgs.length) {
            $imgs.forEach(function ($img) {
              $img.classList.remove(LAZY_LOAD_SPEC);
              observer.observe($img)
            })
          }

          if (self._opts.stickyToc) {
            self.stickyTocHandler()
          }
        });
      }
    })();
    this._scrollHandler = scrollHandler
    window.addEventListener('scroll', scrollHandler)
  }

  stickyTocHandler() {
    var $el = this._$toc.firstChild;
    var rect = this._$md.getBoundingClientRect();

    if (!$el){
      return;
    }
    if (rect.top <= 10) {
      $el.style.top = 0;
    } else {
      $el.style.top = '10px';
    }
  }

  tocRender(toc) {
    if (!toc.length) {
      return this._$md.classList.add('no-toc');
    } else if (this._$md.classList.contains('no-toc')) {
      this._$md.classList.remove('no-toc');
    }
    var html = '<ul class="alpha-markdown-toc">'
    toc.forEach(function (item) {
      html += `<li class="level-${item.level}"><a href="#${item.slug}" alt="${item.title}">${item.title}</a></li>`
    })
    html += '</ul>'

    var $el = this._opts.container.querySelector('.alpha-markdown-toc')
    this._$toc.innerHTML = html
  }

  render(md) {
    var self = this;
    var renderer = this._renderer;
    this._tocs = []
    var html = Marked(md, {
      renderer: renderer
    }, function (err, out) {
      self._$md.innerHTML = out
      setTimeout(function () {
        self._opts.afterRender && self._opts.afterRender({
          $toc: self._$toc,
          tocs: self._tocs,
          $md: self._$md
        })
        self._scrollHandler()
      }, 50)
      return out
    })

    if (this._opts.tocRender) {
      this._opts.tocRender(this._tocs)
    } else if (this._opts.showToc) {
      this.tocRender(this._tocs);
    }
    return html
  }

  setHeadingHandler(renderer) {
    var index = 0
    var self = this;
    renderer.heading = function (text, level) {
      var slug = `nav_slug_${level}_${index++}`
      self._tocs.push({
        level: level,
        slug: slug,
        title: text
      })
      return (self._opts.headingRender && self._opts.headingRender(slug)) ||
        `<h${level} id="${slug}"><a href="#${slug}" class="anchor"></a></a>${text}</h${level}>`
    }
  }

  setImageHandler(renderer) {
    var oldImage = renderer.image
    var self = this
    var resIndex = 0
    renderer.image = function (href, title, text) {
      var freelogSrcReg = /w+\.freelog\.com/gi
      var resourceIdReg = /resource\/(.+)\.data/
      var resourceId //resourceId or presentableId

      if (text === 'freelog-resource') {
        resourceId = href
      }

      if (resourceId) {
        var img = new Image();
        var imgId = `resource_img_${resIndex++}`
        img.id = imgId
        img.src = "//visuals.oss-cn-shenzhen.aliyuncs.com/loading.gif"
        img.alt = text
        img.dataset.src = resourceId
        img.classList.add(LAZY_LOAD_SPEC)
        title && (img.title = title)

        self.loadFreelogResource(resourceId, function (fn) {
          var $img = self._opts.container.querySelector(`#${imgId}`)
          fn($img)
        })
        return img.outerHTML;
      } else {
        return oldImage.apply(renderer, [href, title, text])
      }
    };
  }

  loadFreelogResource(resourceId, done) {
    var self = this;
    return window.FreelogApp.QI.fetchPresentableResourceData(resourceId)
      .then((res) => {
        //fetch image fail
        var type = res.headers.get('freelog-resource-type')
        if (!type) {
          return res.json().then(function (data) {
            done(function ($img) {
              if (self._opts.renderImageError) {
                self._opts.renderImageError($img, data)
              }
            })
          })
        } else {
          return res.blob().then(function (blob) {
            done(function ($img) {
              switch (type) {
                case 'video':
                  self.renderVideo($img, blob)
                  break
                case 'meme':
                  self.renderMeme($img, blob)
                  break
                case 'image':
                default:
                  self.renderImage($img, blob)
              }
            })
          })
        }
      })
      .catch((err) => {
      })
  }

  renderImage($el, blob){
    var src = URL.createObjectURL(blob)
    if ($el.nodeName !== 'IMG') {
      var $image = document.createElement('img')
      $image.src = src
      $el.replaceWith($image)
    } else {
      $el.src = src
    }
  }


  renderMeme($el, blob){

  }

  renderVideo($el, blob){
    var id = 'js-video-'+Math.random().toString().slice(3,8)
    var $video = document.createElement('video')
    $video.style.cssText = 'width: 100%;height: 100%;'
    $video.controls = 'controls'
    // $video.autoplay = 'false'
    $video.id= id
    $el.replaceWith($video)
    setTimeout(()=>{
      $video.src = blob
    })
  }

}

export default MarkdownParser