/**
 * Created by martinwortschack on 05/11/14.
 */
var SetVis = (function(vis) {

    function Renderer() {
        this.settings = {
            canvas: {
                margin: {
                    top: 60,
                    right: 80,
                    bottom: 10,
                    left: 60
                },
                width: 900,
                height: 700
            },
            set: {
                margin: { right: 2 },
                width: 16,
                height: 16,
                stroke: 1
            },
            subset: {
                r: 6
            },
            color: {
                range: ['#FFF7FB', '#023858']
            }
        };
        this.max_sets_per_group = 0;
        this.no_set_groups = 0;
        this.xScale = undefined;
        this.yScale = undefined;
        this.colorScale = undefined;
        this.data = [];
	      this.degreeHist = [];
	      this.bins = {
		        k: 5, //number of desired bins
		        start: [],
		        end: [],
		        data: []
	      };
        this.init();
    }

    Renderer.prototype = {
        init: function() {
            var self = this;
            //this.data = new vis.Parser().helpers.transpose(vis.data.grid);
            this.data = vis.data.fullGrid;
            this.max_sets_per_group = this.settings.canvas.width / this.getTotalSetWidth();

	          //compute degree histogram
	          var elements_per_degree = vis.helpers.getElementsPerDegree(vis.data.grid);
		        this.degreeHist = elements_per_degree.getList();

	          //initialize bins
	          this.initializeBins();

            this.binningView = new BinningView({
                setRenderer: this,
                container: "#binningViewModal"
            });

            this.setupControls();

            initScales();

            function initScales() {
                self.colorScale = d3.scale.linear()
                    .domain([vis.data.min, vis.data.max])
                    .range(self.settings.color.range);

                self.xScale = d3.scale.ordinal()
                    .rangeBands([0, self.settings.canvas.width])
                    .domain(d3.range(self.max_sets_per_group));

                self.yScale = d3.scale.ordinal()
                    .rangeBands([0, self.getSetInnerHeight()])
                    .domain(d3.range(self.bins.k));
            }
        },
	      initializeBins: function() {
						var H = this.degreeHist, //histogram data
								n = H.reduce(function(a, b) { return a + b; }), //total number of elements across all degrees
								b = vis.data.maxDegree; //max degree in histogram data

		        console.log("H ", H, "n ", n , "b ", b);

		        var ind = 0,
			          leftElements = n,
			          binSize,
			          s;

		        for (var bin = 0; bin < this.bins.k; bin++) {
			          this.bins.start[bin] = ind;
			          binSize = H[ind];
			          s = leftElements / (this.bins.k - bin);
			          while ((ind < n - 1) && (binSize + H[ind + 1] <= s)) {
				            ind++;
				            binSize += H[ind];
			          }
			          this.bins.end[bin] = ind;
			          leftElements -= binSize;
			          ind++;
		        }

		        this.classifyData();

		        console.log("bins initialized ", this.bins);
	      },
	      classifyData: function() {
		        for (var i = 0; i < this.bins.k; i++) {
			          var counter = this.bins.start[i];
			          while (counter <= this.bins.end[i]) {
				            if (typeof this.bins.data[i] === "undefined") {
					              this.bins.data[i] = [];
				            }
			              this.bins.data[i].push(vis.data.grid[counter]);
			              counter++;
			          }
		        }
	      },
        setupControls: function() {
            var self = this;

            //setup modal window for binning
            $('#binningViewModal').modal({ show: false });

            $('.ui-controls .btn-edit-binning').on("click", function() {
                self.binningView.render();
                $('#binningViewModal').modal('show');
            });
        },
        render: function() {
            var self = this,
                width = this.settings.canvas.width,
                height = this.settings.canvas.height;

            this.svg = d3.select('#canvas').append("svg")
                .attr("width", width + self.settings.canvas.margin.left)
                .attr("height", height)
                .style("margin-left", -self.settings.canvas.margin.left + "px")
                .append("g")
                .attr("transform", "translate(" + self.settings.canvas.margin.left + "," + self.settings.canvas.margin.top + ")");

            this.renderSets_New();

            //this.renderSets();

            var no_of_set_groups = Math.ceil(this.data.length / this.max_sets_per_group),
                canvasHeight = (this.getSetOuterHeight() + this.settings.canvas.margin.top) * no_of_set_groups;

            this.setCanvasHeight(canvasHeight);
        },
        getTotalSetWidth: function() {
            return this.settings.set.width + 2 * this.settings.set.stroke + this.settings.set.margin.right;
        },
        getSetInnerHeight: function() {
            return this.bins.k * this.settings.set.height;
        },
        getSetOuterHeight: function() {
            return this.getSetInnerHeight() + 2 * this.settings.set.stroke;
        },

	      /* deprecatd */
        renderSets: function() {
            //TODO: remove --> just added for testing
            //this.max_sets_per_group = 10;

            var self = this,
                //data = vis.helpers.chunk(this.data, Math.ceil(this.max_sets_per_group)); //this will just wrap the data array into another level
                //calculate number of set groups needed
                data = vis.helpers.chunk(this.data, Math.ceil(this.max_sets_per_group));

            var setGroups = this.svg.selectAll('.set-group')
                .data(data)
                .enter().append("g")
                .attr("class", "set-group")
                .attr("transform", function(d, i) {
                    var top_offset = self.settings.canvas.margin.top;
                    return "translate(0," + (i * (self.getSetOuterHeight() + top_offset)) + ")";
                });

            setGroups.each(renderSetsNew);
            setGroups.each(renderLabels);

            function renderLabels(setGroup, index) {
                //creates an array from 0 to maxDegree
                var data_y_axis = vis.helpers.createZeroToNArray(vis.data.maxDegree),
                    data_x_axis = vis.data.sets.slice(index * self.max_sets_per_group, index * self.max_sets_per_group + self.max_sets_per_group);

                //render labels for y axis (add labels to given group)
                d3.select(this).selectAll('.y-label')
                    .data(data_y_axis)
                    .enter().append("text")
                    .attr("class", "y-label")
                    .attr("x", -6)
                    .attr("y", function(d, i) { return i * self.settings.set.height + self.settings.subset.r + 3; })
                    .attr("dy", ".32em")
                    .attr("text-anchor", "end")
                    .text(function(d, i) { return i + 1 ; }); //start with degree 1 (not 0)

                //render labels for x axis
                d3.select(this).selectAll('.x-label')
                    .data(data_x_axis)
                    .enter().append("text")
                    .attr("class", "x-label")
                    .attr("transform", function(d, i) {
                        return "rotate(-90)";
                    })
                    .attr("x", 6)
                    .attr("y", function(d, i) { return self.xScale(i) + 7; })
                    .attr("dy", ".32em")
                    .attr("text-anchor", "start")
                    .text(function(d, i) { return d.name; });
            }

            function renderSetsNew(d, i) {
                var sets = d3.select(this).selectAll(".set")
                    .data(data[i])
                    .enter().append("g")
                    .attr("class", "set")
                    .attr("transform", function(d, i) {
                        return "translate(" + self.xScale(i) + ", 0)";
                    });

                sets.each(drawSets);
                sets.each(drawSubsets);
            }

            function drawSets(d, i) {
                //console.log("d ", d, "i ", i);
                //console.log(d3.select(this));

                d3.select(this)
                    .append("rect")
                    .attr("class", "set-background")
                    .attr("x", 0)
                    .attr("width", self.settings.set.width)
                    .attr("height", function(d, i) {
                        return self.bins.k * self.settings.set.height;
                    });
            }

            function drawSubsets(set) {
                var delay;

                var circle = d3.select(this).selectAll('.subset')
                    .data(set)
                    .enter()
                    .append("circle")
                    .attr("class", "subset")
                    .attr("cx", self.settings.set.width/2)
                    .attr("cy", function(d, i) { return self.yScale(i) + self.settings.set.height / 2; })
                    .attr("r", function(d) { return d.count > 0 ? self.settings.subset.r : 0; }) //set radius to 0 for subsets with 0 elements
                    .attr("display", function(d) { return d.count > 0 ? null : "none"; }) //don't show subsets with 0 elements
                    //.style("fill", function(d) { return self.colorScale(d); })
                    .style("fill", function(d) { return self.colorScale(d.count); })
                    .on("mouseover", onMouseover)
                    .on("mouseout", onMouseout)
                    .on("click", onClick);

                function onMouseover(d, i) {
                    var that = this;

                    //delay mouseover event for 500ms
                    delay = setTimeout(function() {
                        var $tooltip = $('#tooltip'),
                            //itemCount = d,
                            itemCount = d.count,
                            degree = i,
                            text = "",
                            //xPos = parseFloat($(this).offset().left - ($tooltip.width() / 2 - self.settings.subset.r / 2)),
                            xPos = parseFloat($(that).offset().left) - ($tooltip.width()/2 + self.getTotalSetWidth()/2 - self.settings.subset.r/2),
                            yPos = parseFloat($(that).offset().top) + 3 * self.settings.subset.r;

                        if (degree > 0) {
                            text = "Items shared with " + degree + " other sets: " + itemCount;
                        } else {
                            text = "Unique items in this set: " + itemCount;
                        }

                        //tooltips
                        d3.select('#tooltip')
                            .style("left", xPos + "px")
                            .style("top", yPos + "px")
                            .text(text)
                            .classed("hidden", false);

                    }, 500);
                }

                function onMouseout() {
                    clearTimeout(delay);
                    d3.select('#tooltip')
                        .classed("hidden", true);
                }

                function onClick(subset, rowIndex) {
                    console.log("subset ", subset, "rowIndex ", rowIndex);
                    var degree = rowIndex + 1,
                        //set_occurrence_map = subset.getSetOccurrenceMap(subset.set_name),
                        elements = subset.getElementNames();

                    //console.log("set_occurrence_map ", set_occurrence_map);

                    //self.selectSubset(subset, rowIndex);
                    self.selectSubset_New(subset, degree);

                }
            }

            //console.log("setGroups ", setGroups);
        },
        clearSelection: function() {
            d3.selectAll('.subset.selected').remove();
            d3.selectAll('.subset.hidden').classed("hidden", false);
        },
        selectSubset_New: function(subset) {
            var set_occurrence_map = vis.helpers.getElementsGroupedBySetAndDegree(subset),
                table = new vis.Table({ container: "#element-table", tableClass: "table table-bordered" });

            //console.log("vis.helpers.getElementsGroupedBySetAndDegree ", vis.helpers.getElementsGroupedBySetAndDegree(subset));

            //first unselect all previously selected elements
            this.clearSelection();

            table.update(subset.elements);

            d3.selectAll('.set-group').selectAll('.set .subset').each(function(d, i) {
                //console.log("d ", d, "i ", i);

                if (typeof set_occurrence_map[d.set_name] !== "undefined" && typeof set_occurrence_map[d.set_name][d.degree] !== "undefined") {
                    //console.log("is ok ", this);

                    var cx = d3.select(this).attr("cx"),
                        cy = d3.select(this).attr("cy"),
                        r = d3.select(this).attr("r");

                    d3.select(this).classed("hidden", true);

                    d3.select(this.parentNode)
                        .append("circle")
                        .attr("class", "subset selected")
                        .attr("cx", cx)
                        .attr("cy", cy)
                        .attr("r", r);
                }

            });
        },
        /* deprecated */
        selectSubset: function(subset, rowIndex) {
            var elements = subset.getElementNames(),
                degree = rowIndex + 1,
                result = [];

            console.log("subset ", subset);
            console.log("all elements ", elements);

            //first unselect all previously selected elements
            this.clearSelection();

            for (var i = 0, len = vis.data.fullGrid.length; i < len; i++) {
                var col = vis.data.fullGrid[i],
                    cell = col[rowIndex];

                var filteredArr = cell.elements.filter(function(el) {
                    if ($.inArray(subset.set_name, el.getSets().split(",")) != -1) {
                        return el;
                    }
                }).map(function(el) {
                    return el.name;
                });

                filteredArr = $.unique(filteredArr);
                filteredArr = $(elements).filter(filteredArr);

                result.push({ setIndex: i, elements: filteredArr });

                //console.log("col ", col, "result ", result);
            }

            var newSelection = new vis.Selection(subset.set_name, subset.degree);
            newSelection.elements = subset.elements;

            var table = new vis.Table({ container: "#element-table", tableClass: "" });
            table.update(subset.elements);

            createSelection(result, rowIndex);

            function createSelection(data, index) {
                console.log("data ", data, "index ", index);

                d3.selectAll('.set-group').selectAll('.set .subset').each(function(d, i) {
                    ////console.log("d ", d, "i ", i);
                    if (d.degree == index + 1 && d.elements.length > 0) {
                        /*
                        var c = document.createElement('circle');
                        c.setAttribute("cx", this.getAttribute("cx"));
                        c.setAttribute("cy", this.getAttribute("cy"));
                        c.setAttribute("r", this.getAttribute("r"));
                        c.setAttribute("style", "fill:rgb(0,0,0);");
                        c.setAttribute("class", "subset");
                        this.parentNode.insertBefore(c, this.nextSibling);
                        */

                        var cx = d3.select(this).attr("cx"),
                            cy = d3.select(this).attr("cy"),
                            r = d3.select(this).attr("r");

                        d3.select(this.parentNode)
                            /*
                            .selectAll(".selected")
                            .data(data)
                            .enter()
                            */
                            .append("circle")
                            .attr("class", "selected")
                            .attr("cx", cx)
                            .attr("cy", cy)
                            .attr("r", r)
                            .attr("fill", "orange");

                    }
                });

            }
        },
        getCanvasHeight: function() {
            return parseInt(d3.select('#canvas svg').attr("height"));
        },
        setCanvasHeight: function(height) {
            d3.select('#canvas svg').attr("height", height);
        },
	      arrangeLabels: function() {
		      var self = this,
			        yLabels = d3.selectAll('.y-label.expanded');

		      d3.selectAll('.degree-label')
			        .remove();

		      yLabels.each(function(d, i) {
			        var lbl = this;
				      d3.select(this.parentNode).selectAll('.degree-label' + ' bin-' + (i + 1))
					        .data(d3.select(this).data()[0])
						      .enter()
						      .append("text")
						      .attr("class", "degree-label bin-" + (i+1))
					        .attr("x", -6)
					        .attr("y", function(d, i) {
						          return parseInt(d3.select(lbl).attr("y")) + (i + 1) * self.settings.set.height;
					        })
					        .attr("dy", ".32em")
					        .attr("text-anchor", "end")
					        .text(function(d, i) { return d; });

			      });
	      },
	      expandRow: function(d, i, data_per_bins, renderer) {
	          var degree_count = d.length,
			          label_yPos = parseInt(d3.select(this).attr("y")),
			          labelIndex = i,
			          additional_height = renderer.settings.set.height * degree_count;

		        //console.log("data_per_bins ", data_per_bins);
		        console.log("additional_height ", additional_height);

			      d3.selectAll('.set-background')
				        .attr("height", function(d, i) {
					          return parseInt(d3.select(this).attr("height")) + additional_height;
			          });

			      d3.selectAll('.set-group')
					      .attr("transform", function(d, i) {
					          //console.log(d3.transform(element.attr("transform")));
							      var top_offset = renderer.settings.canvas.margin.top + additional_height,
								        prev = d3.transform(d3.select(this).attr("transform")).translate[1];

					          console.log("prev ", prev);
							      //return "translate(0," + (i * (renderer.getSetOuterHeight() + top_offset)) + ")";
					          if (i > 0) {
						            return "translate(0," + (prev + i * additional_height) + ")";
					          } else {
						            return "translate(0," + prev + ")";
					          }
					      });


			      var yLabels = d3.selectAll('.y-label')
					      .attr("y", function(d, i) {
						        if (parseInt(d3.select(this).attr("y")) > label_yPos) {
							          return parseInt(d3.select(this).attr("y")) + additional_height;
						        } else {
							          return parseInt(d3.select(this).attr("y"));
						        }
					      })
					      .attr("class", function(d, i) {
						        //sets the expanded resp. collapsed class for the given bin in all set groups
						        if (Math.abs(labelIndex - i - renderer.bins.k) % renderer.bins.k == 0) {
							          return "y-label expanded";
						        } else {
							          return d3.select(this).attr("class");
						        }
					      });

		        renderer.arrangeLabels();

			      var subsets = d3.selectAll('.subset')
				        .attr("cy", function(d, i) {
					        if (parseInt(d3.select(this).attr("cy")) > label_yPos) {
						          return parseInt(d3.select(this).attr("cy")) + additional_height;
					        } else {
						          return parseInt(d3.select(this).attr("cy"));
					        }
				        });

	          /*
	          subsets = subsets.filter(function(d, i) {
		            return parseInt(d3.select(this).attr("data-bin")) == labelIndex;
		        });

			      subsets.each(function(d, i) {
			          console.log("d ", d, "i ", i);
			      });
			      */

			      subsets.each(function(d, i) {
					      //console.log("d ", d, "i ", i);

					      if (parseInt(d3.select(this).attr("data-bin")) == labelIndex && d > 0) {
						        //console.log("matched subset ", i);

						        var subset_y_pos = parseInt(d3.select(this).attr("cy")),
							          subset_x_pos = parseInt(d3.select(this).attr("cx")),
							          setIndex = parseInt(d3.select(this.parentNode).attr("data-set")),
							          bin_entries = getDataForSubset(data_per_bins[labelIndex], setIndex);

						        d3.select(this.parentNode).selectAll('.subset-child')
							          .data(bin_entries)
							          .enter()
							          .append("circle")
							          .attr("class", "subset-child")
							          .attr("data-parent-bin", labelIndex)
							          .attr("cx", subset_x_pos)
							          .attr("cy", function(d, i) { return subset_y_pos + (i + 1) * renderer.settings.set.height; })
							          .attr("r", renderer.settings.subset.r)
							          .attr("fill", function(d) { return d ? renderer.colorScale(d) : "#FFFFFF"; });
			          }
	          });

			      function getDataForSubset(data, index) {
				        //console.log("data ", data, "index ", index);
				        var result = [];
				        for (var i = 0, len = data.length; i < len; i++) {
							      result.push(data[i][index]);
					      }
					      return result;
			      }

			        //update canvas height
			        renderer.setCanvasHeight(renderer.getCanvasHeight() + renderer.no_set_groups * additional_height);
	      },
	      collapseRow: function(d, i, renderer) {
		        var degree_count = d.length,
			          label_yPos = parseInt(d3.select(this).attr("y")),
			          labelIndex = i,
			          additional_height = renderer.settings.set.height * degree_count;

			      d3.selectAll('.set-background')
				        .attr("height", function(d, i) {
					          return parseInt(d3.select(this).attr("height")) - additional_height;
				        });

			      d3.selectAll('.set-group')
				        .attr("transform", function(d, i) {
							      var prev = d3.transform(d3.select(this).attr("transform")).translate[1];

							      if (i > 0) {
								      return "translate(0," + (prev - i * additional_height) + ")";
							      } else {
								      return "translate(0," + prev + ")";
							      }
				        });

			      d3.selectAll('.y-label')
				        .attr("y", function(d, i) {
					          console.log("i ", i);
					          if (parseInt(d3.select(this).attr("y")) > label_yPos) {
						            return parseInt(d3.select(this).attr("y")) - additional_height;
					          } else {
						            return parseInt(d3.select(this).attr("y"));
					          }
				        })
				        .attr("class", function(d, i) {
					          if (Math.abs(labelIndex - i - 5) % 5 == 0) {
						            return "y-label collapsed";
					          } else {
						            return d3.select(this).attr("class");
					          }
				        });

		        renderer.arrangeLabels();

			      d3.selectAll('.subset')
				        .attr("cy", function(d, i) {
					          if (parseInt(d3.select(this).attr("cy")) > label_yPos) {
						            return parseInt(d3.select(this).attr("cy")) - additional_height;
					          } else {
						            return parseInt(d3.select(this).attr("cy"));
					          }
				        });

			      d3.selectAll('.subset-child')
				        .each(function(d, i) {
					          if (parseInt(d3.select(this).attr("data-parent-bin")) == labelIndex) {
						            d3.select(this).remove();
					          }
				        });

			      renderer.setCanvasHeight(renderer.getCanvasHeight() - additional_height);
	      },
        renderSets_New: function() {

            //TODO: remove --> just added for testing
            //this.max_sets_per_group = 10;

            var self = this,
	              aggregated_bin_data = aggregateBinData(this.bins.data),
	              transposed = vis.helpers.transpose(aggregated_bin_data),
	              data_chunks = vis.helpers.chunk(transposed, Math.ceil(this.max_sets_per_group)),
	              data_per_bins = this.bins.data,
	              data_y_axis = createYAxisLabelData();

	          console.log("aggregated_bin_data ", aggregated_bin_data);

	          function createYAxisLabelData() {
		            var result = [];
		            for (var i = 0; i < self.bins.k; i++) {
			              var arr = [],
				                counter = self.bins.start[i];
			              while (counter <= self.bins.end[i]) {
				                arr.push(counter+1);
				                counter++;
			              }
			              result.push(arr);
		            }

		            return result;
	          }

	          function aggregateBinData(data) {
		            var result = d3.range(data.length).map(function(j) {
			                  return Array.apply(null, new Array(vis.data.grid[0].length)).map(Number.prototype.valueOf, 0);
		                });

		            for (var i = 0, len = data.length; i < len; i++) {
			              var current_block = data[i];
			              for (var j = 0, l = current_block.length; j < l; j++) {
				                for (var x = 0, innerlength = current_block[j].length; x < innerlength; x++) {
					                  result[i][x] += current_block[j][x];
				                }
			              }
		            }

		            return result;
	          }

		        function split(a, n) {
			          var len = a.length, out = [], i = 0;
			          while (i < len) {
				            var size = Math.ceil((len - i) / n--);
				            out.push(a.slice(i, i += size));
			          }
			          return out;
		        }

	          //set number of set groups
	          this.no_set_groups = data_chunks.length;

            console.log("data_chunks ", data_chunks);

            var setGroups = this.svg.selectAll('.set-group')
                .data(data_chunks)
                .enter().append("g")
                .attr("class", "set-group")
                .attr("data-set-group", function(d, i) { return i; })
                .attr("transform", function(d, i) {
                    var top_offset = self.settings.canvas.margin.top;
                    return "translate(0," + (i * (self.getSetOuterHeight() + top_offset)) + ")";
                });

            setGroups.each(renderSets);
            setGroups.each(renderLabels);

            function renderSets(d, i) {
                var sets = d3.select(this).selectAll(".set")
                    .data(data_chunks[i])
                    .enter().append("g")
                    .attr("class", "set")
                    .attr("transform", function(d, i) {
                        return "translate(" + self.xScale(i) + ", 0)";
                    })
                    .attr("data-set", function(d, i) {
                        return i + parseInt(d3.select(this.parentNode).attr("data-set-group")) * self.max_sets_per_group;
                    });

                sets.each(drawSets);
                sets.each(drawSubsets);
            }

            function drawSets(d, i) {
                d3.select(this)
                    .append("rect")
                    .attr("class", "set-background")
                    .attr("x", 0)
                    .attr("width", self.settings.set.width)
                    .attr("height", self.bins.k * self.settings.set.height);
            }

            function drawSubsets(set, setIndex) {
                var delay;
                var circle = d3.select(this).selectAll('.subset')
                    .data(set)
                    .enter()
                    .append("circle")
                    .attr("class", "subset")
                    .attr("cx", self.settings.set.width/2)
                    .attr("cy", function(d, i) { return self.yScale(i) + self.settings.set.height / 2; })
                    .attr("r", function(d) { return d > 0 ? self.settings.subset.r : 0; }) //set radius to 0 for subsets with 0 elements
                    .attr("display", function(d) { return d > 0 ? null : "none"; }) //don't show subsets with 0 elements
                    .attr("data-bin", function(d, i) { return i; })
                    //.attr("data-set", setIndex)
                    .style("fill", function(d) { return self.colorScale(d); })
                    .on("mouseover", onMouseover)
                    .on("mouseout", onMouseout)
                    .on("click", selectHandler);

                function onMouseover(d, i) {
                    var that = this;

                    //delay mouseover event for 500ms
                    delay = setTimeout(function() {
                        var $tooltip = $('#tooltip'),
                            itemCount = d,
                            degree = i,
                            text = "",
                            xPos = parseFloat($(that).offset().left) - ($tooltip.width()/2 + self.getTotalSetWidth()/2 - self.settings.subset.r/2),
                            yPos = parseFloat($(that).offset().top) + 3 * self.settings.subset.r;

                        if (degree > 0) {
                            text = "Items shared with " + degree + " other sets: " + itemCount;
                        } else {
                            text = "Unique items in this set: " + itemCount;
                        }

                        //tooltips
                        d3.select('#tooltip')
                            .style("left", xPos + "px")
                            .style("top", yPos + "px")
                            .text(text)
                            .classed("hidden", false);

                    }, 500);
                }

                function onMouseout() {
                    clearTimeout(delay);
                    d3.select('#tooltip')
                        .classed("hidden", true);
                }

                function selectHandler(d, i) {
                    console.log("d ", d, "i ", i);

                    //TODO: implement
                }
            }

            function renderLabels(setGroup, index) {
                var data_x_axis = vis.data.sets.slice(index * self.max_sets_per_group, index * self.max_sets_per_group + self.max_sets_per_group);

                //render labels for y axis (add labels to given group)
                d3.select(this).selectAll('.y-label')
                    .data(data_y_axis)
                    .enter().append("text")
                    .attr("class", "y-label")
                    .classed("collapsed", true)
                    .attr("x", -6)
                    .attr("y", function(d, i) { return i * self.settings.set.height + self.settings.subset.r + 3; })
                    .attr("dy", ".32em")
                    .attr("text-anchor", "end")
                    .text(function(d, i) { return "[" + d[0] + " - " + d[d.length - 1] + "]" ; })
                    .on("click", binClickHandler);

                //render labels for x axis
                d3.select(this).selectAll('.x-label')
                    .data(data_x_axis)
                    .enter().append("text")
                    .attr("class", "x-label")
                    .attr("transform", function(d, i) {
                        return "rotate(-90)";
                    })
                    .attr("x", 6)
                    .attr("y", function(d, i) { return self.xScale(i) + 7; })
                    .attr("dy", ".32em")
                    .attr("text-anchor", "start")
                    .text(function(d, i) { return d.name; });

                function binClickHandler(d, i) {
                    //expand row
                    if (d3.select(this).attr("class").indexOf("expanded") == -1) {
	                      self.expandRow.call(this, d, i, data_per_bins, self);
                    } else {
										//collapse row
	                      self.collapseRow.call(this, d, i, self);
                    }
                }
            }

        }
    };

    function BinningView(initializer) {
        this.setRenderer = initializer.setRenderer;
        this.container = initializer.container;
    }

    BinningView.prototype = {
        render: function() {
            var html = '<div class="modal-dialog modal-lg">' +
                         '<div class="modal-content">' +
                           '<div class="modal-header">' +
                             '<button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>' +
                             '<h4 class="modal-title">Edit <span class="semi-bold">Binning</span></h4>' +
                           '</div>' +
                           '<div class="modal-body">' +
                             '<div class="ui-container">' +
                               '<div class="ui-row">' +
                                  '<div class="ui-column degree-hist"><h5>Elements <span class="semi-bold">per Degree</span></h5></div>'+
                                  '<div class="ui-column custom-bins"></div>' +
                               '</div>' +
                             '</div>' +
                           '</div>' +
                         '</div>' +
                       '</div>';

            $(this.container)
                .empty()
                .html(html);

            this.renderHistogram();
        },
        renderHistogram: function() {
            var elements_per_degree = vis.helpers.getElementsPerDegree(vis.data.grid),
                data = elements_per_degree.getList();

            var margin = { left: 20, top: 10  },
                width = 420,
                barHeight = 20,
                height = barHeight * data.length;

            var xScale = d3.scale.linear()
                .domain([0, d3.max(data)])
                .range([0, width - margin.left]);

            var yScale = d3.scale.linear()
                .domain([0, data.length])
                .range([0, height]);

            var chart = d3.select(".degree-hist")
                .append("svg")
                .attr("width", width)
                .attr("height", barHeight * data.length + margin.top)
                .append("g")
                .attr("transform", function(d, i) { return "translate(" + margin.left + ", " + margin.top + ")"; });

            var bar = chart.selectAll("g")
                .data(data)
                .enter().append("g")
                .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

            bar.append("rect")
                .attr("width", xScale)
                .attr("height", barHeight - 1)
                .attr("y", -barHeight / 2);

            bar.append("text")
                .attr("x", function(d) { return xScale(d) - 3; })
                .attr("dy", ".35em")
                .text(function(d) { return d > 0 ? d : ""; });

            var	yAxis = d3.svg.axis()
                .orient('left')
                .scale(yScale)
                .tickSize(2)
                .tickFormat(function(d, i){ return i + 1; })
                .tickValues(d3.range(data.length));

            chart.append('g')
                .attr("transform", "translate(0,0)")
                .attr('class','yaxis')
                .call(yAxis);

        }
    };

    vis.Renderer = Renderer;

    return vis;

})(SetVis || {});