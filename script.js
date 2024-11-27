const width = window.innerWidth;
const height = window.innerHeight;
const buffer = 5;

const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

let simulation;
let nodes = [];
let links = [];
let currentWord = null;

const zoom = d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

// Updated categoryColors
const categoryColors = {
    selected: "#4169E1", // Blue for the selected word
    synonym: "#5ccf7a",  // Green for synonyms
    antonym: "#e35252",  // Red for antonyms
    variant: "#e3c352",  // Yellow for variants
    root: "#9b52e3",     // Purple for roots
    default: "#d4d4d4"   // Default gray for unselected
};

fetch('http://127.0.0.1:5000/data')
    .then(response => response.json())
    .then(data => {
        console.log("Fetched data:", data); // Log fetched data for verification
        nodes = data.nodes;
        links = createLinks(nodes);
        drawBubbles(nodes, links);

        // Simulate loading completion once data is loaded
        loadingText.textContent = "100%";
        setTimeout(() => {
            loadingScreen.style.opacity = 0;
            setTimeout(() => {
                loadingScreen.style.display = "none";
            }, 500);
        }, 500);
    })
    .catch(error => console.error('Error fetching data:', error));

    document.addEventListener("DOMContentLoaded", () => {
        const loadingScreen = document.getElementById("loading-screen");
        const loadingText = document.getElementById("loading-text");
    
        let progress = 0;
    
        // Simulate loading progress
        const interval = setInterval(() => {
            progress += 1;
            loadingText.textContent = `${progress}%`; // Update the loading percentage text
    
            if (progress >= 100) {
                clearInterval(interval);
    
                // Hide the loading screen and reveal the main content
                loadingScreen.style.transition = "opacity 0.5s ease-out";
                loadingScreen.style.opacity = 0;
    
                setTimeout(() => {
                    loadingScreen.style.display = "none";
                }, 500); // Wait for the fade-out to complete before removing the element
            }
        }, 30); // Adjust the interval speed as needed
    });
    

function createLinks(nodes) {
    const links = [];
    nodes.forEach(node => {
        if (node.azerbaijani_synonyms) {
            node.azerbaijani_synonyms.split(',').forEach(synonym => {
                const targetNode = nodes.find(d => d.id === synonym.trim());
                if (targetNode) links.push({ source: node, target: targetNode, type: 'synonym' });
            });
        }
        if (node.azerbaijani_antonyms) {
            node.azerbaijani_antonyms.split(',').forEach(antonym => {
                const targetNode = nodes.find(d => d.id === antonym.trim());
                if (targetNode) links.push({ source: node, target: targetNode, type: 'antonym' });
            });
        }
        if (node.azerbaijani_variants) {
            node.azerbaijani_variants.split(',').forEach(variant => {
                const targetNode = nodes.find(d => d.id === variant.trim());
                if (targetNode) links.push({ source: node, target: targetNode, type: 'variant' });
            });
        }
        if (node.kok) {
            node.kok.split(',').forEach(root => {
                const targetNode = nodes.find(d => d.id === root.trim());
                if (targetNode) links.push({ source: node, target: targetNode, type: 'root' });
            });
        }
    });
    return links;
}

function drawBubbles(nodes, links) {
    simulation = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(2))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force("collision", d3.forceCollide().radius(d => getBubbleRadius(d) + buffer))
        .on("tick", updatePositions);

    const link = g.selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", d => categoryColors[d.type] || categoryColors.default)
        .attr("stroke-width", "1");

    const node = g.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", d => getBubbleRadius(d) - 10)
        .attr("fill", d => getBubbleColor(d))
        .on("click", (event, d) => {
            if (currentWord !== d) {
                currentWord = d;
                moveToCenter(d, 1, 750);
                displayWordInfo(d);
                updateLineColors();
                updateBubbles();
            }
        })
        .call(drag(simulation));

    const label = g.selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => d.id)
        .attr("font-size", "12px")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("fill", "white")
        .on("click", (event, d) => {
            if (currentWord !== d) {
                currentWord = d;
                moveToCenter(d, 1, 750);
                displayWordInfo(d);
                updateLineColors();
                updateBubbles();
            }
        })
        .each(function(d) {
            const textWidth = this.getComputedTextLength();
            const bubbleRadius = getBubbleRadius(d);
            const availableWidth = (bubbleRadius - buffer) * 2;
            if (textWidth > availableWidth) {
                const scale = availableWidth / textWidth;
                d3.select(this).attr("font-size", Math.floor(12 * scale) + "px");
            }
        });

    function updatePositions() {
        node.attr("cx", d => d.x)
            .attr("cy", d => d.y);

        label.attr("x", d => d.x)
            .attr("y", d => d.y);

        link.attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
    }

    function updateLineColors() {
        link.attr("stroke", d => {
            if (currentWord && (d.source === currentWord || d.target === currentWord)) {
                return categoryColors[d.type] || "#f0f0f0"; // Highlight connected lines
            } else {
                return "#f0f0f0"; // Dim unrelated lines
            }
        }).attr("stroke-width", d =>
            currentWord && (d.source === currentWord || d.target === currentWord) ? "2" : "1"
        ).attr("stroke-dasharray", d =>
            currentWord && (d.source === currentWord || d.target === currentWord) ? "2" : null
        );
    }

    function updateBubbles() {
        g.selectAll("circle").attr("fill", d => {
            if (currentWord && d === currentWord) {
                return categoryColors.selected; // Selected word color
            } else if (currentWord && links.some(link =>
                (link.source === currentWord && link.target === d) ||
                (link.target === currentWord && link.source === d))) {
    
                const link = links.find(link =>
                    (link.source === currentWord && link.target === d) ||
                    (link.target === currentWord && link.source === d)
                );
    
                return categoryColors[link.type] || categoryColors.default; // Relation-based color
            } else {
                return categoryColors.default; // Default color
            }
        });
    }
    
}

function displayWordInfo(word) {
    document.getElementById("selected-word").innerText = word.id;

    updateWordInfo('synonyms-container', word.azerbaijani_synonyms, "green-pill");
    updateWordInfo('antonyms-container', word.azerbaijani_antonyms, "red-pill");
    updateWordInfo('variants-container', word.azerbaijani_variants, "yellow-pill");
    updateWordInfo('kok-container', word.kok, "purple-pill");
    updateWordInfo('sentence-container', word.azerbaijani_sentences, "orange-pill")
}

function updateWordInfo(containerId, wordList, pillClass) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear existing content
    if (wordList) {
        if (containerId === 'sentence-container') {
            // Match sentences prefixed with a number and a period (e.g., "1. ")
            const sentences = wordList.match(/(?:\d+\.\s)([^.]+)/g) || [];
            sentences.forEach(sentence => {
                const pill = document.createElement("div");
                pill.className = `pill ${pillClass}`;
                pill.innerText = sentence.trim(); // Remove leading/trailing spaces
                container.appendChild(pill);
            });
        } else {
            // Default behavior for other containers (e.g., synonyms/antonyms)
            wordList.split(',').forEach(word => {
                const pill = document.createElement("div");
                pill.className = `pill ${pillClass}`;
                pill.innerText = word.trim(); // Remove leading/trailing spaces
                container.appendChild(pill);
            });
        }
    }
}

function getBubbleRadius(d) {
    return 50 + Math.random() * 20;
}

function getBubbleColor(d) {
    if (d.type in categoryColors) return categoryColors[d.type];
    return categoryColors.default;
}

function moveToCenter(d) {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(width / 1.625 - d.x, height / 2 - d.y).scale(1));
}

function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
}

// Updated event listener for the search box
document.getElementById("search-box").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        const searchTerm = this.value.trim().toLowerCase(); // Get the search term
        if (searchTerm) {
            const foundNode = nodes.find(node => node.id.toLowerCase() === searchTerm); // Find the node
            if (foundNode) {
                if (currentWord !== foundNode) {
                    currentWord = foundNode; // Set the current word

                    // Trigger the same behaviors as clicking a bubble
                    moveToCenter(foundNode);       // Zoom to the bubble
                    displayWordInfo(foundNode);    // Display word information
                    updateLineColors();            // Update line colors
                    updateBubbles();               // Update bubble colors
                }
            }
        }
    }
});