import * as d3 from 'd3';

function getTicks(email, mpKey) {
  Promise.all([
    axios.get(`https://www.mountainproject.com/data/get-ticks?email=${email}&key=${mpKey}`),
    axios.get(`https://www.mountainproject.com/data/get-user?email=${email}&key=${mpKey}`)
  ]).then(([ticksResponse, userResponse]) => {
    document.getElementById("mp-key").value = '';
    document.getElementById("log-owner").innerHTML = userResponse.data.name + "'s Ticks";
    getRoutes(ticksResponse.data.ticks,mpKey);
  }, (error) => {
    //TODO return 403 (etc?) back to the UI
    console.log(error.message);
  });
}

function getRoutes(ticks, mpKey) {
  axios.get(`https://www.mountainproject.com/data/get-routes?routeIds=${ticks.map(e => e.routeId).join(',')}&key=${mpKey}`)
  .then(function (response) {
    const routes = response.data.routes.map(i => {
      if(!simpleRating[i.rating]) { console.log(i.rating); }
      if(i.type === '') { console.log(`${i.name} doesn't have a route type set.`); }
      if(getStyle(i.id, "routeId", ticks) === '') { console.log(`${i.name} doesn't have a route style set.`); }
      return {
        'type': i.type,
        'rating': simpleRating[i.rating],
        'style': getStyle(i.id, "routeId", ticks)
      };
    });
    localStorage.setItem('logbook-routes', JSON.stringify(routes));
    localStorage.setItem('logbook-status', Date.now());
    filterRoutes(routes);
  })
  .catch(function (error) {
    console.log(error);
  });
}

function filterRoutes(routes, selectedType='', selectedStyles=[]) {
    const routeTypes = groupBy(routes, 'type');
    // Generate radio buttons based on the different route types
    let index = 0;
    document.getElementById("route-types").innerHTML = "";
    for (let type in routeTypes) {
      if (routeTypes.hasOwnProperty(type) && type != '' && type != 'TR') {
        let checked = '';
        if(selectedType === '' && index === 0) {
          checked = "checked";
          selectedType = type;
        }
        if(selectedType != '' && type === selectedType) { checked = "checked"; }
        let temp_html = `<input type="radio" id="${type}" name="routeType" value="${type}" ${checked}></input><label class="lh-copy ml1 mr3" for="${type}"><strong>${type}</strong> <small>(${routeTypes[type].length})</small></label>`;
        document.getElementById("route-types").insertAdjacentHTML("beforeend", temp_html);
        index++;
      }
    }
    // Generate checkboxes based on the different route styles
    const routeStyles = groupBy(routes, 'style', selectedType);
    document.getElementById("route-styles").innerHTML = "";
    let empty = false;
    if(selectedStyles.length === 0) { empty = true; }
    for (let style in routeStyles) {
      if (routeStyles.hasOwnProperty(style) && style != '') {
        let checked = '';
        if(empty) {
          selectedStyles.push(style);
          checked = "checked";
        }
        if(selectedStyles.includes(style)) { checked = "checked"; }
        let temp_html = `<input type="checkbox" id="${style}" name="routeStyles[]" value="${style}" ${checked}></input><label class="lh-copy ml1 mr3" for="${style}"><strong>${style}</strong> <small>(${routeStyles[style].length})</small></label>`;
        document.getElementById("route-styles").insertAdjacentHTML("beforeend", temp_html);
        index++;
      }
    }

    const formattedTicks = [];
    let routeRatings = groupBy(routeTypes[selectedType].filter(route => selectedStyles.includes(route.style)), 'rating');
    for(var key in routeRatings) {
      if(routeRatings.hasOwnProperty(key)) {
        formattedTicks.push({rating: simpleRating[key], sport: routeRatings[key].length});
      }
    }
    formattedTicks.sort((a, b) => ratingOrder.indexOf(a.rating) - ratingOrder.indexOf(b.rating));
    createGraph({"ticks": formattedTicks});
}

function getStyle(nameKey, prop, myArray){
  for (var i=0; i < myArray.length; i++) {
    if (myArray[i][prop]=== nameKey) {
      return (myArray[i].leadStyle) ? myArray[i].leadStyle : myArray[i].style;
    }
  }
}

function getIssues() {
  axios.get('https://api.github.com/repos/jdillard/personal-site/issues?labels=logbook&state=open')
    .then(function (response) {
      for (let c in response.data) {
        let temp_html = '<div class="mv2"><a class="no-underline relative f6 black-70 hover-light-red" href="'+response.data[c].html_url+'">'+response.data[c].title+'</a></div>';
        document.getElementById("issues").insertAdjacentHTML("beforeend", temp_html);
      }
    })
    .catch(function (error) {
      console.log(error);
  });
}

// If a route has multiple types, it is added to all of its types
const groupBy = function(xs, key, firstType='') {
  return xs.reduce(function(rv, x) {
    if(key === "type") {
      const types = x.type.split(', ');
      types.forEach(function (type) {
        (rv[type] = rv[type] || []).push(x);
      });
    } else if(key === "style") {
      if(x.type.includes(firstType)) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
      }
    } else {
      (rv[x[key]] = rv[x[key]] || []).push(x);
    }
    return rv;
  }, {});
};

function createGraph(logData) {
  document.getElementById("log-chart").innerHTML = "";

  var w = document.getElementById("log-chart").clientWidth,
      h = 30 * logData.ticks.length;

  // margin.middle is distance from center line to each y-axis
  var margin = {
    top: 20,
    right: 20,
    bottom: 24,
    left: 20,
    middle: 28
  };

  // the width of each side of the chart
  var regionWidth = w/2 - margin.middle;

  // these are the x-coordinates of the y-axes
  var pointA = regionWidth,
      pointB = w - regionWidth;

  // GET THE TOTAL POPULATION SIZE AND CREATE A FUNCTION FOR RETURNING THE PERCENTAGE
  var totalPopulation = d3.sum(logData.ticks, function(d) { return d.sport; });

  var svg = d3.select("#log-chart")
    .attr('width', margin.left + w + margin.right)
    .attr('height', margin.top + h + margin.bottom)
    // ADD A GROUP FOR THE SPACE WITHIN THE MARGINS
    .append('g')
      .attr('transform', translation(margin.left, margin.top));

  var maxValue = Math.max(
    d3.max(logData.ticks, function(d) { return d.sport; })
  );

  // SET UP SCALES

  // the xScale goes from 0 to the width of a region
  //  it will be reversed for the left x-axis
  var xScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, regionWidth])
    .nice();

  var xScaleLeft = d3.scaleLinear()
    .domain([0, maxValue])
    .range([regionWidth, 0]);

  var xScaleRight = d3.scaleLinear()
    .domain([0, maxValue])
    .range([0, regionWidth]);

  var yScale = d3.scaleBand()
    .domain(logData.ticks.map(function(d) { return d.rating; }))
    .range([h,0], 0.1);

  // SET UP AXES
  var yAxisLeft = d3.axisRight(yScale)
    .tickSize(4,0)
    .tickPadding(margin.middle-4);

  var yAxisRight = d3.axisLeft(yScale)
    .tickSize(4,0)
    .tickFormat('');

  var xAxisRight = d3.axisBottom(xScale)
    .ticks(maxValue,"d");

  // REVERSE THE X-AXIS SCALE ON THE LEFT SIDE BY REVERSING THE RANGE
  var xAxisLeft = d3.axisBottom(xScale.copy().range([pointA, 0]))
    .ticks(maxValue,"d");

  // MAKE GROUPS FOR EACH SIDE OF CHART
  // scale(-1,1) is used to reverse the left side so the bars grow left instead of right
  var leftBarGroup = svg.append('g')
    .attr('transform', translation(pointA, 0) + 'scale(-1,1)');
  var rightBarGroup = svg.append('g')
    .attr('transform', translation(pointB, 0));

  // DRAW AXES
  svg.append('g')
    .attr('class', 'axis y left')
    .attr('transform', translation(pointA, 0))
    .call(yAxisLeft)
    .selectAll('text')
    .style('text-anchor', 'middle');

  svg.append('g')
    .attr('class', 'axis y right')
    .attr('transform', translation(pointB, 0))
    .call(yAxisRight);

  svg.append('g')
    .attr('class', 'axis x left')
    .attr('transform', translation(0, h))
    .call(xAxisLeft);

  svg.append('g')
    .attr('class', 'axis x right')
    .attr('transform', translation(pointB, h))
    .call(xAxisRight);

  // DRAW BARS
  leftBarGroup.selectAll('.bar.left')
    .data(logData.ticks)
    .enter().append('rect')
      .attr('class', 'bar left')
      .attr('x', 0)
      .attr('y', function(d) { return yScale(d.rating); })
      .attr('width', function(d) { return xScale(d.sport); })
      .attr('height', yScale.bandwidth());

  rightBarGroup.selectAll('.bar.right')
    .data(logData.ticks)
    .enter().append('rect')
      .attr('class', 'bar right')
      .attr('x', 0)
      .attr('y', function(d) { return yScale(d.rating); })
      .attr('width', function(d) { return xScale(d.sport); })
      .attr('height', yScale.bandwidth());

  function translation(x,y) {
    return 'translate(' + x + ',' + y + ')';
  }
}

const simpleRating = {
  "5.6": "5.6",
  "5.7": "5.7",
  "5.8": "5.8",
  "5.8 R": "5.8",
  "5.8+": "5.8",
  "5.8+ R": "5.8",
  "5.9-": "5.9",
  "5.9": "5.9",
  "5.9 R": "5.9",
  "5.9+": "5.9",
  "5.10-": "5.10a",
  "5.10": "5.10b",
  "5.10a": "5.10a",
  "5.10a/b": "5.10b",
  "5.10b": "5.10b",
  "5.10b PG13": "5.10b",
  "5.10b R": "5.10b",
  "5.10c": "5.10c",
  "5.10b/c": "5.10c",
  "5.10+": "5.10d",
  "5.10d": "5.10d",
  "5.11a": "5.11a",
  "5.11b": "5.11b",
  "V1": "V1",
  "V1+": "V1",
  "V1+ PG13": "V1",
  "V2": "V2",
  "V2+": "V2",
  "V3": "V3",
  "V3+": "V3",
  "V4": "V4",
  "V4+": "V4",
  "V5": "V5",
  "V5+": "V5",
  "V6": "V6",
  "V6+": "V6",
  "V7": "V7",
  "V7+": "V7"
};

const ratingOrder = ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b"];

$("#mp-submit").click(function() {
  const email = document.getElementById("mp-email").value;
  const mpKey = document.getElementById("mp-key").value;

  if(email && mpKey) {
    getTicks(email, mpKey);
  } else {
    alert("There was an error");
  }
});

//TODO figure out how to use reDrawGraph
$('#route-types').on('change', function() {
  const selectedType = $("input[name='routeType']:checked").val();
  filterRoutes(JSON.parse(localStorage.getItem("logbook-routes")), selectedType);
});

window.addEventListener('resize', reDrawGraph());

function reDrawGraph() {
  if(localStorage.getItem("logbook-routes")) {
    const selectedType = $("input[name='routeType']:checked").val();
    let selectedStyles = [];
    $.each($("input[name='routeStyles[]']:checked"), function() {
      selectedStyles.push($(this).val());
    });
    filterRoutes(JSON.parse(localStorage.getItem("logbook-routes")), selectedType, selectedStyles);
  } else {
    axios.get('/assets/json/ticks.json')
      .then(function (response) {
        localStorage.setItem('logbook-routes', JSON.stringify(response.data));
        filterRoutes(response.data);
      })
      .catch(function (error) {
        console.log(error);
      });
  }
}

$('#route-styles').on('change', function() {
  reDrawGraph();
 });

$("#issues-toggle").click(function() {
  if($("#issues").hasClass('open')) {
    $("#issues").removeClass('open');
    $("#issues-toggle").text('Show Known Issues');
    $("#issues").height(0);
    document.getElementById("issues").innerHTML = "";
  } else {
    $("#issues").addClass('open');
    $("#issues-toggle").text('Hide Known Issues');
    getIssues();
    $("#issues").height('auto');
  }
});
