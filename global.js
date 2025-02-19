document.addEventListener("DOMContentLoaded", () => {
  // ---------- LIGHT/DARK MODE ----------
  const toggleButton = document.getElementById("toggle-theme");
  if (toggleButton)
    toggleButton.addEventListener("click", () => document.body.classList.toggle("dark"));

  // ---------- TOOLTIP SETUP ----------
  const plotContainer = document.getElementById("plot");
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.style.opacity = 0;
  plotContainer.appendChild(tooltip);

  // ---------- INTRO GAME VARIABLES ----------
  const conditions = ["Rest", "2-Back", "Running"];
  let introActive = true, introTimerStarted = false;
  let introTimerID, introClickCount = 0;
  let currentCondIndex = 0, introTime = 5; // seconds

  // ---------- HEART BUTTON ----------
  const heartButton = document.getElementById("heart-button");
  heartButton.style.display = "block";

  // ---------- LEGEND & SLIDER ----------
  const legendContainer = document.getElementById("legend");
  legendContainer.style.display = "none";
  const legendToggle = document.getElementById("legend-toggle");
  legendToggle.style.display = "none";
  legendToggle.addEventListener("click", () => {
    if (legendContainer.style.display === "none") {
      legendContainer.style.display = "block";
      legendToggle.textContent = "Hide Legend";
    } else {
      legendContainer.style.display = "none";
      legendToggle.textContent = "Show Legend";
    }
  });
  let pointsToAdd = 100;
  const slider = document.getElementById("points-slider");
  const sliderValueLabel = document.getElementById("slider-value");
  const sliderLabel = document.getElementById("slider-label");
  slider.value = pointsToAdd;
  slider.addEventListener("input", () => {
    pointsToAdd = +slider.value;
    sliderValueLabel.textContent = slider.value;
  });

  // ---------- NARRATIVE ----------
  const narrativeContainer = document.getElementById("narrative");
  const stepsText = {
    "1": "Step 1: The chart fades in in gray.",
    "2": "Step 2: Points change color (heart red, respiration blue).",
    "3": "Step 3: Respiratory points are hidden.",
    "4": "Step 4: Rest points are highlighted.",
    "5": "Step 5: 2‑Back and Running are revealed.",
    "6": "Step 6: Interactive mode active."
  };
  function updateNarrative(text) {
    narrativeContainer.innerHTML = `<p>${text}</p>`;
  }
  // Use constant text (except for the countdown time)
  function updateIntroText() {
    updateNarrative(`Intro Game: For condition <strong>${conditions[currentCondIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: ${introTime} s.`);
  }
  updateIntroText();

  // ---------- GLOBAL VARIABLES ----------
  let svg, chartArea, xScale, yScale, zoom;
  let initialPoints, additionalPoints;
  let currentStep = 0, totalSteps = 6;
  let interactiveActive = false, clickEnabled = true;
  let remainingData; // global extra points

  // ---------- GLOBAL COLOR MAPPING & SYMBOL ----------
  const activityColors = { "Running": "#e41a1c", "Rest": "#377eb8", "2-Back": "#4daf4a", "Walking": "#ff7f00" };
  const symbolGen = d3.symbol().size(64);

  // ---------- SIMPLE PULSE ANIMATION ----------
  function pulseDot() {
    if (!svg) return;
    const hb = heartButton.getBoundingClientRect();
    const svgRect = svg.node().getBoundingClientRect();
    const cx = hb.left + hb.width/2 - svgRect.left;
    const cy = hb.top + hb.height/2 - svgRect.top;
    const dot = chartArea.append("circle")
      .attr("cx", cx).attr("cy", cy).attr("r", 8)
      .attr("fill", "#fff").attr("opacity", 1);
    dot.transition().duration(200).attr("r", 4)
      .transition().duration(200).attr("r", 8)
      .transition().duration(200).style("opacity", 0).remove();
  }

  // ---------- INTRO GAME TIMER ----------
  function startIntroTimer() {
    introTimerStarted = true;
    updateIntroText();
    introTimerID = setInterval(() => {
      introTime--;
      updateIntroText();
      if (introTime <= 0) {
        clearInterval(introTimerID);
        const predicted = Math.min(introClickCount * 12, 200);
        console.log(`Prediction for ${conditions[currentCondIndex]}: ${predicted} BPM`);
        // Draw prediction line
        const predLine = chartArea.append("line")
          .attr("class", "prediction-line")
          .attr("x1", 0)
          .attr("y1", yScale(predicted))
          .attr("x2", xScale.range()[1])
          .attr("y2", yScale(predicted))
          .attr("stroke", activityColors[conditions[currentCondIndex]] || "black")
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.8);
        predLine.on("mouseover", (e) => {
          tooltip.style.opacity = 1;
          tooltip.innerHTML = `<strong>User estimated:</strong> ${predicted} BPM (${conditions[currentCondIndex]})`;
        }).on("mousemove", (e) => {
          const [mx, my] = d3.pointer(e, plotContainer);
          tooltip.style.left = (mx+15)+"px";
          tooltip.style.top = (my-10)+"px";
        }).on("mouseout", () => tooltip.style.opacity = 0);
        currentCondIndex++;
        introClickCount = 0; introTime = 5; introTimerStarted = false;
        if (currentCondIndex < conditions.length)
          updateNarrative(`Intro Game: For condition <strong>${conditions[currentCondIndex]}</strong>, click the heart. Time remaining: 5 s.`);
        else {
          introActive = false;
          updateNarrative("Intro game complete! Proceeding with visualization...");
          initialPoints.transition().duration(500).attr("opacity", 0.8);
          setTimeout(() => updateStep(1), 1000);
        }
      }
    }, 1000);
  }

  // ---------- DATA LOADING & REGRESSION ----------
  const dataPaths = [
    "data/sampled_2-Back.csv",
    "data/sampled_Rest.csv",
    "data/sampled_Running.csv",
    "data/sampled_Walking.csv"
  ];
  const regressionPaths = [
    "data/regression_2-Back_heart.csv",
    "data/regression_Rest_heart.csv",
    "data/regression_Running_heart.csv",
    "data/regression_Walking_heart.csv",
    "data/regression_2-Back_breathing.csv",
    "data/regression_Rest_breathing.csv",
    "data/regression_Running_breathing.csv",
    "data/regression_Walking_breathing.csv"
  ];
  Promise.all([...dataPaths.map(p => d3.csv(p)), ...regressionPaths.map(p => d3.csv(p))])
    .then(files => {
      // Process original data (first 4 files)
      let fullData = [];
      files.slice(0,4).forEach(arr => fullData = fullData.concat(arr.slice(0,100)));
      fullData.forEach(d => {
        d.timestamp = +d.timestamp;
        d.heart_rate = +d.heart_rate;
        d.breathing_rate = +d.breathing_rate;
      });
      let expanded = fullData.flatMap(d => [
        { ...d, measure:"heart_rate", value: d.heart_rate },
        { ...d, measure:"breathing_rate", value: d.breathing_rate }
      ]);
      expanded = d3.shuffle(expanded);
      // Group by activity and sample 100 points per activity.
      const groups = d3.group(expanded, d => d.activity);
      let initialData = [];
      let currentIndexByActivity = {};
      groups.forEach((arr, act) => {
        d3.shuffle(arr);
        const n = Math.min(100, arr.length);
        currentIndexByActivity[act] = n;
        initialData = initialData.concat(arr.slice(0, n));
      });
      // Remaining data: all points not in initialData.
      remainingData = d3.shuffle(expanded.filter(d => !initialData.includes(d)));

      // Process regression data (files 5-12)
      const regressionData = { heart_rate: {}, breathing_rate: {} };
      files.slice(4).forEach((arr, i) => {
        const parts = regressionPaths[i].split('_'); // e.g., regression_2-Back_heart.csv
        const activity = parts[1];
        const measureKey = parts[2].split('.')[0] === "heart" ? "heart_rate" : "breathing_rate";
        regressionData[measureKey][activity] = arr.map(d => ({
          timestamp: +d.timestamp,
          predicted: measureKey === "heart_rate" ? +d.predicted_heart_rate : +d.predicted_breathing_rate
        })).filter(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
      });

      // ---------- SVG SETUP ----------
      const margin = { top:20, right:20, bottom:60, left:80 };
      const containerWidth = plotContainer.clientWidth || 600;
      const width = containerWidth - margin.left - margin.right;
      const height = 500 - margin.top - margin.bottom;
      svg = d3.select("#plot").append("svg")
        .attr("width", width+margin.left+margin.right)
        .attr("height", height+margin.top+margin.bottom);
      chartArea = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // ---------- SCALES & AXES ----------
      xScale = d3.scaleLinear().domain(d3.extent(expanded, d => d.timestamp)).range([0,width]).nice();
      yScale = d3.scaleLinear().domain([d3.extent(expanded, d => d.value)[0]-5, d3.extent(expanded, d => d.value)[1]+5]).range([height,0]).nice();
      const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat(d => d + " s");
      const yAxis = d3.axisLeft(yScale);
      chartArea.append("g").attr("class","x-axis").attr("transform", `translate(0,${height})`).call(xAxis);
      chartArea.append("g").attr("class","y-axis").call(yAxis);
      chartArea.append("text")
        .attr("class","x-axis-label")
        .attr("x", width/2)
        .attr("y", height+margin.bottom-10)
        .attr("text-anchor","middle")
        .text("Timestamp (seconds) across 5 minutes");
      yAxisLabel = chartArea.append("text")
        .attr("class","y-axis-label")
        .attr("transform","rotate(-90)")
        .attr("x", -height/2)
        .attr("y", -margin.left+20)
        .attr("text-anchor","middle")
        .text("Heart Rate / Respiration Rate");

      // ---------- ZOOM & PAN ----------
      zoom = d3.zoom()
        .scaleExtent([1,20])
        .translateExtent([[0,0],[width,height]])
        .extent([[0,0],[width,height]])
        .on("zoom", (event) => {
          const newX = event.transform.rescaleX(xScale);
          const newY = event.transform.rescaleY(yScale);
          initialPoints.attr("transform", d => `translate(${newX(d.timestamp)},${newY(d.value)})`);
          additionalPoints.attr("transform", d => `translate(${newX(d.timestamp)},${newY(d.value)})`);
          chartArea.select(".x-axis").call(xAxis.scale(newX));
          chartArea.select(".y-axis").call(yAxis.scale(newY));
          // (Regression lines update omitted here for brevity; include if needed.)
        });
      svg.call(zoom);
      svg.on("dblclick", () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity));

      // ---------- DRAW INITIAL POINTS (Hidden) ----------
      initialPoints = chartArea.selectAll(".point.initial")
        .data(initialData)
        .enter()
        .append("path")
        .attr("class", "point initial non-interactive")
        .attr("d", d => symbolGen.type(d.measure==="heart_rate" ? d3.symbolCircle : d3.symbolSquare)())
        .attr("transform", d => `translate(${xScale(d.timestamp)},${yScale(d.value)})`)
        .attr("fill", d => activityColors[d.activity] || "gray")
        .attr("stroke", "none")
        .attr("opacity", 0)
        .on("mouseover", (event,d) => {
          if (!interactiveActive) return;
          d3.select(event.currentTarget).classed("highlight", true);
          tooltip.style.opacity = 1;
          tooltip.innerHTML = `<strong>${d.activity}</strong>: ${d.value.toFixed(1)} (${d.measure})`;
        })
        .on("mousemove", (event,d) => {
          const [mx, my] = d3.pointer(event, plotContainer);
          tooltip.style.left = (mx+15)+"px"; tooltip.style.top = (my-10)+"px";
        })
        .on("mouseout", () => tooltip.style.opacity = 0);
      additionalPoints = chartArea.selectAll(".point.additional");

      // ---------- REGRESSION LINES ----------
      const regressionGroups = {};
      ["heart_rate", "breathing_rate"].forEach(measure => {
        regressionGroups[measure] = chartArea.append("g")
          .attr("class", `regression-lines ${measure}`)
          .style("display", "none");
      });
      Object.entries(regressionData).forEach(([measure, activities]) => {
        Object.entries(activities).forEach(([act, data]) => {
          if (data.length === 0) return;
          data.sort((a,b) => a.timestamp - b.timestamp);
          const line = d3.line()
            .x(d => xScale(d.timestamp))
            .y(d => yScale(d.predicted))
            .defined(d => !isNaN(d.timestamp) && !isNaN(d.predicted));
          regressionGroups[measure].append("path")
            .datum(data)
            .attr("class", `regression-line ${act}`)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", activityColors[act])
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
          regressionGroups[measure].append("path")
            .datum(data)
            .attr("class", `regression-overlay ${act}`)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", "transparent")
            .attr("stroke-width", 8)
            .attr("pointer-events", "stroke")
            .on("mouseover", (e) => {
              tooltip.style.opacity = 1;
              tooltip.innerHTML = `<strong>Regression:</strong> ${act}`;
            })
            .on("mousemove", (e) => {
              const [mx, my] = d3.pointer(e, plotContainer);
              tooltip.style.left = (mx+15)+"px"; tooltip.style.top = (my-10)+"px";
            })
            .on("mouseout", () => tooltip.style.opacity = 0);
        });
      });
      d3.select(".regression-checkbox").on("change", function() {
        const checked = this.checked;
        if (checked) {
          ["heart_rate","breathing_rate"].forEach(measure => {
            regressionGroups[measure].style("display", "block");
          });
        } else {
          ["heart_rate","breathing_rate"].forEach(measure => {
            regressionGroups[measure].style("display", "none");
          });
        }
      });

      // ---------- INTRO GAME & NARRATIVE ----------
      function updateIntroGame() {
        updateNarrative(`Intro Game: For condition <strong>${conditions[currentCondIndex]}</strong>, click the heart as many times as you think represent its beats in 5 seconds. Time remaining: ${introTime} s.`);
      }
      updateIntroGame();
      function startIntroTimer() {
        introTimerStarted = true;
        updateIntroGame();
        introTimerID = setInterval(() => {
          introTime--;
          updateIntroGame();
          if (introTime <= 0) {
            clearInterval(introTimerID);
            const predicted = Math.min(introClickCount * 12, 200);
            console.log(`Prediction for ${conditions[currentCondIndex]}: ${predicted} BPM`);
            const predLine = chartArea.append("line")
              .attr("class", "prediction-line")
              .attr("x1", 0)
              .attr("y1", yScale(predicted))
              .attr("x2", xScale.range()[1])
              .attr("y2", yScale(predicted))
              .attr("stroke", activityColors[conditions[currentCondIndex]] || "black")
              .attr("stroke-dasharray", "4,4")
              .attr("opacity", 0.8);
            predLine.on("mouseover", (e) => {
              tooltip.style.opacity = 1;
              tooltip.innerHTML = `<strong>User estimated:</strong> ${predicted} BPM (${conditions[currentCondIndex]})`;
            }).on("mousemove", (e) => {
              const [mx, my] = d3.pointer(e, plotContainer);
              tooltip.style.left = (mx+15)+"px"; tooltip.style.top = (my-10)+"px";
            }).on("mouseout", () => tooltip.style.opacity = 0);
            currentCondIndex++;
            introClickCount = 0; introTime = 5; introTimerStarted = false;
            if (currentCondIndex < conditions.length)
              updateNarrative(`Intro Game: For condition <strong>${conditions[currentCondIndex]}</strong>, click the heart. Time remaining: 5 s.`);
            else {
              introActive = false;
              updateNarrative("Intro game complete! Proceeding with visualization...");
              initialPoints.transition().duration(500).attr("opacity", 0.8);
              setTimeout(() => updateStep(1), 1000);
            }
          }
        }, 1000);
      }

      // ---------- HEART BUTTON HANDLER ----------
      heartButton.addEventListener("click", () => {
        pulseDot();
        if (introActive) {
          if (!introTimerStarted) startIntroTimer();
          introClickCount++;
          updateIntroGame();
          return;
        }
        if (!clickEnabled) return;
        clickEnabled = false;
        heartButton.classList.add("beat");
        setTimeout(() => heartButton.classList.remove("beat"), 600);
        if (currentStep < totalSteps) {
          currentStep++;
          updateStep(currentStep);
        } else if (interactiveActive) {
          addMorePoints();
        }
        setTimeout(() => { clickEnabled = true; 
          if (currentStep >= totalSteps) document.getElementById("skip-button").style.display = "none";
        }, 1100);
      });

      // ---------- UPDATE STEP FUNCTION ----------
      function updateStep(step) {
        console.log("Step", step);
        switch (step) {
          case 1:
            initialPoints.transition().duration(1000)
              .attr("fill", "gray").attr("opacity", 0.8)
              .on("end", () => updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"));
            break;
          case 2:
            initialPoints.transition().duration(1000)
              .attr("fill", d => d.measure==="heart_rate" ? "#d7191c" : "#2c7bb6")
              .on("end", () => updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"));
            break;
          case 3:
            initialPoints.transition().duration(1000)
              .attr("opacity", d => d.measure==="heart_rate" ? 0.8 : 0)
              .on("end", () => updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"));
            break;
          case 4:
            initialPoints.transition().duration(1000)
              .attr("fill", d => (d.measure==="heart_rate" && d.activity==="Rest") ? "#377eb8" : "gray")
              .attr("opacity", d => d.measure==="heart_rate" ? 0.8 : 0)
              .on("end", () => updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"));
            break;
          case 5:
            initialPoints.transition().duration(1000)
              .attr("fill", d => {
                if(d.measure==="heart_rate"){
                  if(d.activity==="2-Back") return "#4daf4a";
                  if(d.activity==="Running") return "#e41a1c";
                  if(d.activity==="Rest") return "#377eb8";
                }
                return "gray";
              })
              .attr("opacity", d => d.measure==="heart_rate" ? 0.8 : 0)
              .on("end", () => updateNarrative(stepsText[step] + " <em>Click the heart to continue...</em>"));
            break;
          case 6:
            initialPoints.transition().duration(1000)
              .attr("fill", d => activityColors[d.activity] || "gray")
              .attr("opacity", 0.8)
              .on("end", () => {
                updateNarrative(stepsText[step]);
                initialPoints.classed("non-interactive", false);
                svg.call(zoom);
                interactiveActive = true;
                legendContainer.style.display = "block";
                slider.style.display = "block";
                sliderLabel.style.display = "block";
                legendToggle.style.display = "block";
                legendToggle.textContent = "Hide Legend";
                heartButton.style.display = "block";
                updateYAxisLabel();
                document.getElementById("skip-button").style.display = "none";
              });
            break;
          default: break;
        }
      }

      // ---------- AXIS LABEL UPDATE ----------
      function updateYAxisLabel() {
        const hr = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
        const br = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
        yAxisLabel.text(hr && !br ? "Heart Rate (BPM)" : !hr && br ? "Respiration Rate" : hr && br ? "Heart Rate / Respiration Rate" : "Rate");
      }

      // ---------- SKIP FUNCTION ----------
      function skipToInteractive() {
        console.log("Skip animation button clicked");
        if (introActive) { clearInterval(introTimerID); introActive = false; }
        initialPoints.interrupt().classed("non-interactive", false)
          .attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8);
        additionalPoints.attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8);
        svg.call(zoom);
        interactiveActive = true;
        legendContainer.style.display = "block";
        slider.style.display = "block";
        sliderLabel.style.display = "block";
        legendToggle.style.display = "block";
        legendToggle.textContent = "Hide Legend";
        updateNarrative(stepsText[6]);
        heartButton.style.display = "block";
        currentStep = totalSteps;
        document.getElementById("skip-button").style.display = "none";
      }
      document.getElementById("skip-button").addEventListener("click", skipToInteractive);

      // ---------- ADD/REMOVE POINTS FUNCTION ----------
      function addMorePoints() {
        if (pointsToAdd >= 0) {
          const hb = heartButton.getBoundingClientRect();
          const svgRect = svg.node().getBoundingClientRect();
          const startX = hb.left + hb.width/2 - svgRect.left;
          const startY = hb.top + hb.height/2 - svgRect.top;
          const newData = remainingData.slice(0, pointsToAdd);
          remainingData = remainingData.slice(pointsToAdd);
          newData.forEach(d => {
            chartArea.append("path")
              .datum(d)
              .attr("class", "point additional")
              .attr("d", () => symbolGen.type(d.measure==="heart_rate" ? d3.symbolCircle : d3.symbolSquare)())
              .attr("fill", activityColors[d.activity] || "gray")
              .attr("stroke", "none")
              .attr("opacity", 0)
              .attr("transform", `translate(${startX},${startY})`)
              .transition().duration(1000)
              .attr("opacity", 0.8)
              .attr("transform", `translate(${xScale(d.timestamp)},${yScale(d.value)})`);
          });
          additionalPoints = chartArea.selectAll("path.point.additional");
        } else {
          const numToRemove = Math.abs(pointsToAdd);
          const nodes = chartArea.selectAll("path.point.additional").nodes();
          const hb = heartButton.getBoundingClientRect();
          const svgRect = svg.node().getBoundingClientRect();
          const hx = hb.left + hb.width/2 - svgRect.left, hy = hb.top + hb.height/2 - svgRect.top;
          nodes.slice(-numToRemove).forEach(node => {
            d3.select(node).transition().duration(1000)
              .attr("transform", `translate(${hx},${hy})`)
              .style("opacity", 0)
              .remove();
          });
          additionalPoints = chartArea.selectAll("path.point.additional");
        }
      }

      // ---------- LEGEND & MEASURE INTERACTIONS ----------
      d3.selectAll(".activity-checkbox").on("change", function () {
        if (interactiveActive) {
          const act = this.value;
          const lab = this.parentElement;
          lab.style.backgroundColor = this.checked ? activityColors[act] : "";
          lab.style.color = this.checked ? "#fff" : "";
          initialPoints.attr("fill", d => {
            const chk = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
            return (chk && chk.checked) ? activityColors[d.activity] : "gray";
          });
          d3.selectAll(".point.additional")
            .attr("fill", d => {
              const chk = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
              return (chk && chk.checked) ? activityColors[d.activity] : "gray";
            });
        }
      });
      d3.selectAll(".measure-checkbox").on("change", () => {
        if (interactiveActive) {
          initialPoints.attr("display", d => {
            const chk = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
            return (chk && chk.checked) ? null : "none";
          });
          d3.selectAll(".point.additional")
            .attr("display", d => {
              const chk = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
              return (chk && chk.checked) ? null : "none";
            });
          const hr = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
          const br = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
          let newDomain;
          if (hr && br) newDomain = [0,200];
          else if (hr && !br) newDomain = [d3.extent(expanded.filter(d => d.measure==="heart_rate"), d => d.value)[0]-5,
                                             d3.extent(expanded.filter(d => d.measure==="heart_rate"), d => d.value)[1]+5];
          else if (!hr && br) newDomain = [d3.extent(expanded.filter(d => d.measure==="breathing_rate"), d => d.value)[0]-5,
                                             d3.extent(expanded.filter(d => d.measure==="breathing_rate"), d => d.value)[1]+5];
          else newDomain = yScale.domain();
          yScale.domain(newDomain).nice();
          updateYAxisLabel();
          initialPoints.transition().duration(750)
            .attr("transform", d => `translate(${xScale(d.timestamp)},${yScale(d.value)})`);
          d3.selectAll(".point.additional").transition().duration(750)
            .attr("transform", d => `translate(${xScale(d.timestamp)},${yScale(d.value)})`);
          chartArea.select(".y-axis").transition().duration(750).call(yAxis);
        }
      });

    }).catch(error => console.error("Error loading data:", error));
});
