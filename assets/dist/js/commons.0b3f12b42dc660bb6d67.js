webpackJsonp([4],{177:function(e,t,o){"use strict";function n(){var e=baffle("#logo").start().set({characters:"░█▓ ▓▒░<>/",speed:60}).text(function(e){return"Jared Dillard"});setTimeout(function(){e.reveal(500)},500)}function r(){var e=["farmer of bits","web developer"],t=baffle("#logo").start().set({characters:"░█▓ ▓▒░<>/",speed:60}).text(function(t){return e[Math.floor(Math.random()*e.length)]});setTimeout(function(){t.reveal(500)},500)}window.onload=function(){n()},document.getElementById("logo").onmouseover=function(){r()},document.getElementById("logo").onmouseleave=function(){n()}}},[177]);