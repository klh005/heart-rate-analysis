document.addEventListener("DOMContentLoaded", () => {
  // Light/Dark Mode Toggle
  const toggleButton = document.getElementById("toggle-theme");
  toggleButton.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });
  
  // Set up D3 Visualization
  const vizContainer = document.getElementById("viz-container");
  const svgWidth = vizContainer.clientWidth;
  const svgHeight = vizContainer.clientHeight;

  // Append SVG element
  const svg = d3.select("#viz-container")
                .append("svg")
                .attr("width", svgWidth)
                .attr("height", svgHeight);

  // Sample data: heart rate values across four movements
  const data = [
    { movement: "Movement 1", heartRate: 75 },
    { movement: "Movement 2", heartRate: 85 },
    { movement: "Movement 3", heartRate: 95 },
    { movement: "Movement 4", heartRate: 105 }
  ];

  // Scales
  const xScale = d3.scaleBand()
                   .domain(data.map(d => d.movement))
                   .range([50, svgWidth - 50])
                   .padding(0.4);

  const yScale = d3.scaleLinear()
                   .domain([0, d3.max(data, d => d.heartRate) + 20])
                   .range([svgHeight - 50, 50]);

  // Axes
  svg.append("g")
     .attr("transform", `translate(0, ${svgHeight - 50})`)
     .call(d3.axisBottom(xScale));

  svg.append("g")
     .attr("transform", `translate(50, 0)`)
     .call(d3.axisLeft(yScale));

  // Bars
  svg.selectAll(".bar")
     .data(data)
     .enter()
     .append("rect")
     .attr("class", "bar")
     .attr("x", d => xScale(d.movement))
     .attr("y", d => yScale(d.heartRate))
     .attr("width", xScale.bandwidth())
     .attr("height", d => svgHeight - 50 - yScale(d.heartRate))
     .attr("fill", "var(--accent-color)")
     .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", "orange");
        tooltip.style("display", "block")
               .html(`<strong>${d.movement}</strong><br/>Heart Rate: ${d.heartRate}`);
     })
     .on("mousemove", function (event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 25) + "px");
     })
     .on("mouseout", function () {
        d3.select(this).attr("fill", "var(--accent-color)");
        tooltip.style("display", "none");
     });

  // Tooltip
  const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("background", "#fff")
                    .style("padding", "5px 10px")
                    .style("border", "1px solid #ccc")
                    .style("border-radius", "4px")
                    .style("pointer-events", "none")
                    .style("display", "none");
});
