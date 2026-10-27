(function () {
  'use strict';
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hero = document.getElementById('home');
  var heroVisible = true;

  /* A bounded star field: tiny CSS layers, no particle simulation. */
  var starfield = document.getElementById('starfield');
  var planet = document.getElementById('planetSystem');
  var starCount = window.matchMedia('(max-width: 650px)').matches ? 16 : 38;
  var stars = document.createDocumentFragment();
  for (var starIndex = 0; starIndex < starCount; starIndex++) {
    var star = document.createElement('span');
    star.className = 'star space-motion';
    star.style.cssText = 'left:' + (starIndex * 61.803 % 100) + '%;top:' +
      (starIndex * 37.917 % 96) + '%;--star-size:' + (starIndex % 6 === 0 ? 3 : 2) +
      'px;--twinkle:' + (3.5 + starIndex % 6) + 's;animation-delay:-' + (starIndex % 9) + 's';
    stars.appendChild(star);
  }
  starfield.appendChild(stars);

  /* One-shot, staggered entrances. Unobserved content stays visible if JS fails. */
  document.querySelectorAll('.section').forEach(function (section) {
    section.querySelectorAll('.reveal').forEach(function (el, i) {
      el.style.setProperty('--rd', Math.min(i % 7, 5) * 65 + 'ms');
    });
  });
  if ('IntersectionObserver' in window) {
    var entrance = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entrance.unobserve(entry.target);
        }
      });
    }, { threshold: .06 });
    document.querySelectorAll('.reveal').forEach(function (el) { entrance.observe(el); });

    var navigation = document.querySelectorAll('.nav-item');
    var sections = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navigation.forEach(function (link) {
          var active = link.dataset.target === entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-28% 0px -48% 0px' });
    document.querySelectorAll('.section').forEach(function (section) { sections.observe(section); });

    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      document.body.classList.toggle('past-hero', !heroVisible);
      syncMotion();
    }).observe(hero);
  }
  var portrait = document.querySelector('.portrait-disc');
  var portraitVideo = document.querySelector('.portrait-video');
  if (portraitVideo) {
    portraitVideo.addEventListener('playing', function () { portrait.classList.add('is-playing'); });
    portraitVideo.addEventListener('pause', function () { portrait.classList.remove('is-playing'); });
    portraitVideo.addEventListener('canplay', syncVideo);
  }
  function syncVideo() {
    if (!portraitVideo) return;
    if (motion.matches || document.hidden || !heroVisible) {
      portraitVideo.pause();
      return;
    }
    var attempt = portraitVideo.play();
    if (attempt && attempt.catch) attempt.catch(function () {});
  }
  function syncMotion() {
    document.body.classList.toggle('motion-paused', document.hidden || !heroVisible || motion.matches);
    syncVideo();
  }
  document.addEventListener('visibilitychange', syncMotion);
  motion.addEventListener('change', syncMotion);
  syncMotion();

  /* Pointer feedback is scoped to the hero and schedules at most one frame per event burst. */
  var shield = document.querySelector('.shield-svg');
  var pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var pointerFrame = 0;
  var pointerX = 0, pointerY = 0;
  hero.addEventListener('pointermove', function (event) {
    if (motion.matches || !pointer.matches) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(function () {
      pointerFrame = 0;
      var rect = hero.getBoundingClientRect();
      var x = Math.max(-.5, Math.min(.5, (pointerX - rect.left) / rect.width - .5));
      var y = Math.max(-.5, Math.min(.5, (pointerY - rect.top) / rect.height - .5));
      shield.style.transform = 'perspective(900px) rotateY(' + x * 11 + 'deg) rotateX(' + -y * 8 + 'deg)';
      planet.style.setProperty('--space-x', x * -18 + 'px');
      planet.style.setProperty('--space-y', y * -12 + 'px');
      starfield.style.transform = 'translate3d(' + x * 9 + 'px,' + y * 7 + 'px,0)';
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', function () {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    shield.style.transform = '';
    planet.style.removeProperty('--space-x');
    planet.style.removeProperty('--space-y');
    starfield.style.transform = '';
  });

  /* Copy still works in local-file previews as well as on HTTPS. */
  var toast = document.getElementById('toast');
  var toastTimer;
  function fallbackCopy(text) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { /* Keep a readable failure message. */ }
    field.remove();
    return ok;
  }
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var text = button.dataset.copy;
      var ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; }
      catch (_) { ok = fallbackCopy(text); }
      toast.textContent = ok ? '已复制：' + text : '复制失败，请手动选择号码';
      toast.classList.add('is-show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-show'); }, 2200);
    });
  });

  /* A single rendered globe texture. No render loop, no WebGL, no network assets. */
  var canvas = document.getElementById('globe');
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var radians = Math.PI / 180;
  // Low-detail geographic silhouettes are sufficient for a background at this scale.
  var land = [
    [[-168,70],[-140,72],[-125,60],[-125,48],[-118,32],[-101,20],[-83,9],[-77,24],[-62,45],[-52,52],[-64,60],[-96,72]],
    [[-80,10],[-65,10],[-50,0],[-35,-8],[-42,-23],[-54,-35],[-68,-55],[-76,-38],[-80,-10]],
    [[-18,35],[7,37],[32,30],[43,12],[51,10],[41,-15],[31,-35],[17,-35],[10,-20],[-1,5],[-16,15]],
    [[-10,36],[-9,59],[7,71],[34,70],[65,74],[110,73],[145,63],[180,65],[170,51],[142,43],[130,30],[117,22],[108,5],[98,8],[90,23],[78,8],[68,24],[53,27],[44,12],[36,30],[27,41],[14,44],[2,43]],
    [[113,-11],[133,-12],[143,-20],[153,-27],[146,-39],[130,-34],[114,-28]],
    [[47,-13],[51,-16],[48,-26],[44,-24]],
    [[130,32],[138,34],[143,44],[146,43],[141,33]],
    [[95,5],[106,-6],[119,-8],[124,-4],[113,0]],
    [[-53,60],[-28,69],[-22,82],[-48,83],[-62,75]],
    [[-8,50],[-4,59],[1,58],[1,51]]
  ];
  function isLand(lon, lat) {
    return land.some(function (polygon) {
      var inside = false;
      for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var a = polygon[i], b = polygon[j];
        if (((a[1] > lat) !== (b[1] > lat)) && lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    });
  }
  function project(lon, lat, center, radius) {
    var longitude = (lon - 60) * radians;
    var latitude = lat * radians;
    var x = Math.cos(latitude) * Math.sin(longitude);
    var y = -Math.sin(latitude);
    var z = Math.cos(latitude) * Math.cos(longitude);
    var tilt = -.16;
    var yy = y * Math.cos(tilt) - x * Math.sin(tilt);
    var xx = y * Math.sin(tilt) + x * Math.cos(tilt);
    return { x: center + xx * radius, y: center + yy * radius, z: z };
  }
  function draw() {
    var size = canvas.clientWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var c = size / 2, radius = size * .395;
    var atmosphere = ctx.createRadialGradient(c, c, radius * .97, c, c, radius * 1.17);
    atmosphere.addColorStop(0, 'rgba(25,114,193,.02)');
    atmosphere.addColorStop(.27, 'rgba(44,142,222,.17)');
    atmosphere.addColorStop(.6, 'rgba(31,107,184,.055)');
    atmosphere.addColorStop(1, 'rgba(15,58,104,0)');
    ctx.fillStyle = atmosphere;
    ctx.fillRect(0, 0, size, size);
    var sphere = ctx.createRadialGradient(c + radius * .45, c - radius * .35, 0, c, c, radius);
    sphere.addColorStop(0, '#123258');
    sphere.addColorStop(.6, '#0b2241');
    sphere.addColorStop(1, '#071527');
    ctx.fillStyle = sphere;
    ctx.beginPath(); ctx.arc(c, c, radius, 0, Math.PI * 2); ctx.fill();

    function line(points) {
      var started = false;
      ctx.beginPath();
      points.forEach(function (point) {
        var p = project(point[0], point[1], c, radius);
        if (p.z < 0) { started = false; return; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(100,170,225,.12)'; ctx.lineWidth = .65;
    for (var lat = -60; lat <= 60; lat += 20) {
      var horizontal = [];
      for (var lon = -180; lon <= 180; lon += 3) horizontal.push([lon, lat]);
      line(horizontal);
    }
    for (var meridian = -180; meridian < 180; meridian += 20) {
      var vertical = [];
      for (var parallel = -90; parallel <= 90; parallel += 3) vertical.push([meridian, parallel]);
      line(vertical);
    }
    // Dotted continents create a recognisable Earth while keeping the texture light.
    for (var latitude = -56; latitude < 82; latitude += 2.8) {
      for (var longitude = -178; longitude < 180; longitude += 2.8 / Math.max(.4, Math.cos(latitude * radians))) {
        if (!isLand(longitude, latitude)) continue;
        var p = project(longitude, latitude, c, radius);
        if (p.z <= .015) continue;
        var alpha = .12 + p.z * .29;
        ctx.fillStyle = 'rgba(112,195,239,' + alpha + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, size * .00115, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(96,187,242,.26)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, radius, 0, Math.PI * 2); ctx.stroke();
    // A few great-circle routes, rather than hundreds of foreground particles.
    ctx.strokeStyle = 'rgba(90,174,230,.18)'; ctx.lineWidth = .8;
    [[-10,50,125,35],[20,-30,115,40],[-20,0,140,55]].forEach(function (route) {
      var arc = [];
      for (var i = 0; i <= 60; i++) {
        var t = i / 60;
        arc.push([route[0] + (route[2] - route[0]) * t, route[1] + (route[3] - route[1]) * t + Math.sin(t * Math.PI) * 15]);
      }
      line(arc);
    });
  }
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 160);
  }, { passive: true });
  draw();
})();
