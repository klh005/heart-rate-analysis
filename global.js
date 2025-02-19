document.addEventListener("DOMContentLoaded", () => {
  // --- Light/Dark Mode Toggle ---
  const toggleButton = document.getElementById("toggle-theme");
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  } else {
    console.warn("Toggle theme button not found in DOM.");
  }

  // --- Tooltip Setup ---
  const plotContainer = document.getElementById("plot");
  let tooltip;
  if (plotContainer) {
    tooltip = document.createElement("div");
    tooltip.classList.add("tooltip");
    tooltip.style.opacity = 0;
    plotContainer.appendChild(tooltip);
  }

  // --- Heart Button Setup ---
  const heartButton = document.getElementById("heart-button");
  if (heartButton) {
    console.log("Heart button found:", heartButton);
    heartButton.style.display = "block";
  } else {
    console.warn("Heart button not found in DOM. Ensure your HTML includes <button id='heart-button'>❤</button>");
  }

  // --- Legend Container ---
  const legendContainer = document.getElementById("legend");
  if (legendContainer) {
    legendContainer.style.display = "none"; // Hidden until interactive mode.
  }

  // --- Legend Toggle Button ---
  const legendToggle = document.getElementById("legend-toggle");
  if (legendToggle) {
    legendToggle.style.display = "none"; // Hidden until interactive mode.
    legendToggle.addEventListener("click", () => {
      if (legendContainer.style.display !== "none") {
        legendContainer.style.display = "none";
        legendToggle.innerHTML = "Show Legend";
      } else {
        legendContainer.style.display = "block";
        legendToggle.innerHTML = "Hide Legend";
      }
    });
  }

  // --- Points Slider Setup ---
  let pointsToAdd = 100;
  const slider = document.getElementById("points-slider");
  const sliderValueLabel = document.getElementById("slider-value");
  const sliderLabel = document.getElementById("slider-label");
  if (slider) {
    slider.value = pointsToAdd;
    slider.addEventListener("input", () => {
      pointsToAdd = +slider.value;
      if (sliderValueLabel) {
        sliderValueLabel.textContent = slider.value;
      }
    });
    // Initially hidden via CSS.
  }

  // --- Narrative Container ---
  const narrativeContainer = document.getElementById("narrative");
  const stepsText = {
    "1": "Step 1: The chart starts off with all data points in gray.",
    "2": "Step 2: Now the points separate by measure: heart rate turns red and respiratory rate turns blue.",
    "3": "Step 3: The respiratory (blue) points are hidden, leaving only heart rate visible.",
    "4": "Step 4: Heart rate points for Rest are highlighted.",
    "5": "Step 5: Next, cognitive load (2‑Back) and physical load (Running) are revealed with their own colors.",
    "6": "Step 6: The chart is now fully interactive! Both heart rate and respiratory points are visible. Use the legend to toggle query options."
  };

  // Declare variables to be used across the data callback.
  let svg, chartArea, xScale, yScale, zoomBehavior, yAxisLabel;
  let initialPoints, additionalPoints;

  // --- Data Loading & Combination ---
  const dataPaths = [
    "data/sampled_2-Back.csv",
    "data/sampled_Rest.csv",
    "data/sampled_Running.csv",
    "data/sampled_Walking.csv"
  ];

  Promise.all(dataPaths.map(path => d3.csv(path)))
    .then(files => {
      let fullData = [];
      files.forEach(dataArray => {
        // Use only the first 100 rows from each CSV.
        fullData = fullData.concat(dataArray.slice(0, 100));
      });
      console.log("Full data rows:", fullData.length);
      fullData.forEach(d => {
        d.timestamp = +d.timestamp;
        d.heart_rate = +d.heart_rate;
        d.breathing_rate = +d.breathing_rate;
      });
      const fullDataExpanded = fullData.flatMap(d => [
        { ...d, measure: "heart_rate", value: d.heart_rate },
        { ...d, measure: "breathing_rate", value: d.breathing_rate }
      ]);
      console.log("Expanded data points:", fullDataExpanded.length);
      const groups = d3.group(fullDataExpanded, d => d.activity);
      let currentIndexByActivity = {};
      let initialDisplayedData = [];
      groups.forEach((arr, key) => {
        d3.shuffle(arr);
        currentIndexByActivity[key] = Math.min(100, arr.length);
        initialDisplayedData = initialDisplayedData.concat(arr.slice(0, currentIndexByActivity[key]));
      });
      console.log("Initial displayed points:", initialDisplayedData.length);

      // --- SVG Setup ---
      const margin = { top: 20, right: 20, bottom: 60, left: 80 };
      const containerWidth = plotContainer.clientWidth || 600;
      const width = containerWidth - margin.left - margin.right;
      const height = 500 - margin.top - margin.bottom;
      svg = d3.select("#plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
      chartArea = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // --- Scales & Axes ---
      xScale = d3.scaleLinear()
        .domain(d3.extent(fullDataExpanded, d => d.timestamp))
        .range([0, width])
        .nice();
      yScale = d3.scaleLinear()
        .domain([d3.extent(fullDataExpanded, d => d.value)[0] - 5, d3.extent(fullDataExpanded, d => d.value)[1] + 5])
        .range([height, 0])
        .nice();
      const xAxis = d3.axisBottom(xScale)
        .ticks(6)
        .tickFormat(d => d + " s");
      const yAxis = d3.axisLeft(yScale);
      chartArea.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);
      chartArea.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

      // --- Add Axis Labels ---
      chartArea.append("text")
        .attr("class", "x-axis-label")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "middle")
        .text("Timestamp (seconds) across 5 minutes");
      yAxisLabel = chartArea.append("text")
        .attr("class", "y-axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .text("Heart Rate / Respiration Rate");

      // --- Zoom & Pan Setup (Final Interactive Mode) ---
      zoomBehavior = d3.zoom()
        .scaleExtent([1, 20])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", (event) => {
          const transform = event.transform;
          const newXScale = transform.rescaleX(xScale);
          const newYScale = transform.rescaleY(yScale);
          initialPoints.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });
          additionalPoints.attr("transform", d => {
            const tx = newXScale(d.timestamp);
            const ty = newYScale(d.value);
            return `translate(${tx},${ty})`;
          });
          chartArea.select(".x-axis").call(xAxis.scale(newXScale));
          chartArea.select(".y-axis").call(yAxis.scale(newYScale));
        });
      svg.on("dblclick", () => {
        svg.transition().duration(750)
          .call(zoomBehavior.transform, d3.zoomIdentity);
      });

      // --- Color Mapping ---
      const activityColors = {
        "Running": "#e41a1c",
        "Rest": "#377eb8",
        "2-Back": "#4daf4a",
        "Walking": "#ff7f00"
      };

      // --- Draw Initial Points ---
      const symbolGenerator = d3.symbol().size(64);
      initialPoints = chartArea.selectAll(".point.initial")
        .data(initialDisplayedData)
        .enter()
        .append("path")
        .attr("class", "point initial non-interactive")
        .attr("d", d => {
          if (d.measure === "heart_rate") {
            symbolGenerator.type(d3.symbolCircle);
          } else {
            symbolGenerator.type(d3.symbolSquare);
          }
          return symbolGenerator();
        })
        .attr("transform", d => {
          const tx = xScale(d.timestamp);
          const ty = yScale(d.value);
          return `translate(${tx},${ty})`;
        })
        .attr("fill", d => activityColors[d.activity] || "gray")
        .attr("stroke", "none")
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {
          if (!interactiveActive) return;
          d3.select(this).classed("highlight", true);
          if (!tooltip) return;
          tooltip.style.opacity = 1;
          tooltip.innerHTML = `
            <strong>Activity:</strong> ${d.activity}<br/>
            <strong>Measure:</strong> ${d.measure}<br/>
            <strong>Value:</strong> ${d.value.toFixed(1)}<br/>
            <strong>Time:</strong> ${d.timestamp.toFixed(1)} s
          `;
        })
        .on("mousemove", function(event, d) {
          if (!interactiveActive) return;
          if (!tooltip) return;
          const [mx, my] = d3.pointer(event, plotContainer);
          tooltip.style.left = (mx + 15) + "px";
          tooltip.style.top = (my - 10) + "px";
        })
        .on("mouseout", function() {
          if (!interactiveActive) return;
          d3.select(this).classed("highlight", false);
          if (tooltip) tooltip.style.opacity = 0;
        });
      additionalPoints = chartArea.selectAll(".point.additional");

      // --- Narrative & Heart Button Setup ---
      let currentStep = 0;
      const totalSteps = 6;
      let interactiveActive = false;
      let clickEnabled = true;
      function updateNarrative(step) {
        if (narrativeContainer) {
          if (step === 0) {
            narrativeContainer.innerHTML = `<p>Click the heart to start the animation...</p>`;
          } else {
            narrativeContainer.innerHTML = `<p>${stepsText[step]}</p><p style="font-style: italic; color: var(--accent-color);">Click the heart to continue...</p>`;
          }
        }
        if (heartButton && step < totalSteps) {
          heartButton.style.display = "block";
        }
      }
      updateNarrative(0);

      // --- Update Step Function ---
      function updateStep(step) {
        console.log("Running animation for step", step);
        switch (step) {
          case 1:
            initialPoints.transition().duration(1000)
              .attr("fill", "gray")
              .attr("opacity", 0.8)
              .on("end", () => { updateNarrative(step); });
            break;
          case 2:
            initialPoints.transition().duration(1000)
              .attr("fill", d => d.measure === "heart_rate" ? "#d7191c" : "#2c7bb6")
              .on("end", () => { updateNarrative(step); });
            break;
          case 3:
            initialPoints.transition().duration(1000)
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 4:
            initialPoints.transition().duration(1000)
              .attr("fill", d => (d.measure === "heart_rate" && d.activity === "Rest") ? "#377eb8" : "gray")
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 5:
            initialPoints.transition().duration(1000)
              .attr("fill", d => {
                if (d.measure === "heart_rate") {
                  if (d.activity === "2-Back") return "#4daf4a";
                  if (d.activity === "Running") return "#e41a1c";
                  if (d.activity === "Rest") return "#377eb8";
                }
                return "gray";
              })
              .attr("opacity", d => d.measure === "heart_rate" ? 0.8 : 0)
              .on("end", () => { updateNarrative(step); });
            break;
          case 6:
            initialPoints.transition().duration(1000)
              .attr("fill", d => activityColors[d.activity] || "gray")
              .attr("opacity", 0.8)
              .on("end", () => {
                updateNarrative(step);
                initialPoints.classed("non-interactive", false);
                svg.call(zoomBehavior);
                interactiveActive = true;
                if (legendContainer) {
                  legendContainer.style.display = "block";
                }
                if (slider) {
                  slider.style.display = "block";
                }
                if (sliderLabel) {
                  sliderLabel.style.display = "block";
                }
                if (legendToggle) {
                  legendToggle.style.display = "block";
                  legendToggle.innerHTML = "Hide Legend";
                }
                // KEEP the heart button visible so it can pump points.
                if (heartButton) {
                  heartButton.style.display = "block";
                }
                updateYAxisLabel();
              });
            break;
          default:
            break;
        }
      }

      // --- Axis Label Update Function ---
      function updateYAxisLabel() {
        const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
        const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
        if (hrChecked && !brChecked) {
          yAxisLabel.text("Heart Rate (beats/min)");
        } else if (!hrChecked && brChecked) {
          yAxisLabel.text("Respiration Rate (breaths/min)");
        } else if (hrChecked && brChecked) {
          yAxisLabel.text("Heart Rate / Respiration Rate");
        } else {
          yAxisLabel.text("Rate");
        }
      }

      // --- Function to Add/Remove Points with Pumping Animation ---
      function addMorePoints() {
        // If slider value is positive, add points normally.
        if (pointsToAdd >= 0) {
          let heartRect = heartButton.getBoundingClientRect();
          let svgRect = svg.node().getBoundingClientRect();
          let startX = heartRect.left + heartRect.width / 2 - svgRect.left;
          let startY = heartRect.top + heartRect.height / 2 - svgRect.top;
          groups.forEach((arr, activity) => {
            let currentIndex = currentIndexByActivity[activity] || 0;
            if (currentIndex >= arr.length) return;
            let newIndex = Math.min(currentIndex + pointsToAdd, arr.length);
            let newPointsData = arr.slice(currentIndex, newIndex);
            currentIndexByActivity[activity] = newIndex;
            newPointsData.forEach(d => {
              let finalX = xScale(d.timestamp);
              let finalY = yScale(d.value);
              chartArea.append("path")
                .datum(d)
                .attr("class", "point additional")
                .attr("d", () => {
                  if (d.measure === "heart_rate") {
                    symbolGenerator.type(d3.symbolCircle);
                  } else {
                    symbolGenerator.type(d3.symbolSquare);
                  }
                  return symbolGenerator();
                })
                .attr("fill", activityColors[d.activity] || "gray")
                .attr("stroke", "none")
                .attr("opacity", 0)
                .attr("transform", `translate(${startX}, ${startY})`)
                .transition().duration(1000)
                .attr("opacity", 0.8)
                .attr("transform", `translate(${xScale(d.timestamp)}, ${yScale(d.value)})`);
            });
          });
          additionalPoints = chartArea.selectAll(".point.additional");
        } else {
          // If slider value is negative, remove the last |pointsToAdd| additional points with an animation.
          let numToRemove = Math.abs(pointsToAdd);
          // Get the additional points as an array.
          let additionalNodes = chartArea.selectAll("path.point.additional").nodes();
          // Calculate heart button center.
          let heartRect = heartButton.getBoundingClientRect();
          let svgRect = svg.node().getBoundingClientRect();
          let heartX = heartRect.left + heartRect.width / 2 - svgRect.left;
          let heartY = heartRect.top + heartRect.height / 2 - svgRect.top;
          // Select the last numToRemove nodes.
          let nodesToRemove = additionalNodes.slice(-numToRemove);
          nodesToRemove.forEach(node => {
            d3.select(node)
              .transition()
              .duration(1000)
              .attr("transform", `translate(${heartX}, ${heartY})`)
              .style("opacity", 0)
              .remove();
          });
          additionalPoints = chartArea.selectAll("path.point.additional");
        }
      }

      // --- Heart Button Click Handler ---
      if (heartButton) {
        heartButton.addEventListener("click", () => {
          if (!clickEnabled) return;
          clickEnabled = false;
          heartButton.classList.add("beat");
          setTimeout(() => {
            heartButton.classList.remove("beat");
          }, 600);
          if (currentStep < totalSteps) {
            currentStep++;
            updateStep(currentStep);
          } else if (interactiveActive) {
            addMorePoints();
          }
          setTimeout(() => {
            clickEnabled = true;
            if (currentStep < totalSteps) {
              heartButton.style.display = "block";
            }
          }, 1100);
        });
      }

      // --- Skip Animation Function ---
      function skipToInteractive() {
        console.log("Skip animation button clicked");
        initialPoints.interrupt();
        additionalPoints.interrupt();
        initialPoints.classed("non-interactive", false)
          .attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8)
          .attr("display", null);
        additionalPoints.attr("fill", d => activityColors[d.activity] || "gray")
          .attr("opacity", 0.8)
          .attr("display", null);
        svg.call(zoomBehavior);
        interactiveActive = true;
        if (legendContainer) {
          legendContainer.style.display = "block";
        }
        if (slider) {
          slider.style.display = "block";
        }
        if (sliderLabel) {
          sliderLabel.style.display = "block";
        }
        if (legendToggle) {
          legendToggle.style.display = "block";
          legendToggle.innerHTML = "Hide Legend";
        }
        if (narrativeContainer) {
          narrativeContainer.innerHTML = `<p>${stepsText[6]}</p>`;
        }
        // KEEP the heart button visible to pump points.
        if (heartButton) {
          heartButton.style.display = "block";
        }
        currentStep = totalSteps;
        // Disable skip button after skipping.
        skipButton.disabled = true;
        skipButton.style.display = "none";
      }
      const skipButton = document.getElementById("skip-button");
      if (skipButton) {
        skipButton.addEventListener("click", skipToInteractive);
      }

      // --- Legend Interactions ---
      d3.selectAll(".activity-checkbox").on("change", function() {
        if (interactiveActive) {
          const activity = this.value;
          const label = this.parentElement;
          if (this.checked) {
            label.style.backgroundColor = activityColors[activity];
            label.style.color = "#fff";
          } else {
            label.style.backgroundColor = "";
            label.style.color = "";
          }
          initialPoints.attr("fill", d => {
            const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
            return (checkbox && checkbox.checked) ? (activityColors[d.activity] || "gray") : "gray";
          });
          d3.selectAll(".point.additional")
            .attr("fill", d => {
              const checkbox = document.querySelector(`.activity-checkbox[value="${d.activity}"]`);
              return (checkbox && checkbox.checked) ? (activityColors[d.activity] || "gray") : "gray";
            });
        }
      });

      d3.selectAll(".measure-checkbox").on("change", () => {
        if (interactiveActive) {
          initialPoints.attr("display", d => {
            const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
            return (checkbox && checkbox.checked) ? null : "none";
          });
          d3.selectAll(".point.additional")
            .attr("display", d => {
              const checkbox = document.querySelector(`.measure-checkbox[value="${d.measure}"]`);
              return (checkbox && checkbox.checked) ? null : "none";
            });
          const hrChecked = document.querySelector('.measure-checkbox[value="heart_rate"]').checked;
          const brChecked = document.querySelector('.measure-checkbox[value="breathing_rate"]').checked;
          let newYDomain;
          if (hrChecked && brChecked) {
            newYDomain = [0, 200];
          } else if (hrChecked && !brChecked) {
            const hrExtent = d3.extent(fullDataExpanded.filter(d => d.measure === "heart_rate"), d => d.value);
            newYDomain = [hrExtent[0] - 5, hrExtent[1] + 5];
          } else if (!hrChecked && brChecked) {
            const brExtent = d3.extent(fullDataExpanded.filter(d => d.measure === "breathing_rate"), d => d.value);
            newYDomain = [brExtent[0] - 5, brExtent[1] + 5];
          } else {
            newYDomain = yScale.domain();
          }
          yScale.domain(newYDomain).nice();
          updateYAxisLabel();
          initialPoints.transition().duration(750)
            .attr("transform", d => {
              const tx = xScale(d.timestamp);
              const ty = yScale(d.value);
              return `translate(${tx},${ty})`;
            });
          d3.selectAll(".point.additional").transition().duration(750)
            .attr("transform", d => {
              const tx = xScale(d.timestamp);
              const ty = yScale(d.value);
              return `translate(${tx},${ty})`;
            });
          chartArea.select(".y-axis")
            .transition().duration(750)
            .call(yAxis);
        }
      });
    })
    .catch(error => {
      console.error("Error loading data:", error);
    });
});
