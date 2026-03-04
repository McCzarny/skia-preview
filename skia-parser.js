// Skia Icon Format Parser and Renderer using SVG

class SkiaIconParser {
    constructor() {
        this.commands = [];
        this.canvasDimensions = 15; // default
    }

    parse(content) {
        this.commands = [];
        this.canvasDimensions = 15;

        // Remove comments and split into lines
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('//'));

        // Parse each line
        for (const line of lines) {
            const parts = line.split(',').map(p => p.trim());
            if (parts.length === 0) continue;

            const command = parts[0];
            const args = parts.slice(1).map(arg => {
                // Check if it's a hex number (0x or 0X prefix)
                if (typeof arg === 'string' && arg.toLowerCase().startsWith('0x')) {
                    return parseInt(arg, 16);
                }
                // Otherwise try to parse as float
                const num = parseFloat(arg);
                return isNaN(num) ? arg : num;
            });

            if (command === 'CANVAS_DIMENSIONS') {
                this.canvasDimensions = args[0];
            } else {
                this.commands.push({ command, args });
            }
        }

        return this;
    }

    // Convert Skia commands to SVG paths (supports multi-color icons)
    toSVGPaths() {
        const paths = [];
        let currentPath = { pathData: '', color: null, fillRule: 'evenodd' };
        let currentX = 0;
        let currentY = 0;

        for (const { command, args } of this.commands) {
            switch (command) {
                case 'PATH_COLOR_ARGB':
                    // ARGB format: alpha, red, green, blue (values 0-255, already parsed from hex if needed)
                    const alpha = args[0];
                    const red = args[1];
                    const green = args[2];
                    const blue = args[3];
                    
                    currentPath.color = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`;
                    break;

                case 'FILL_RULE_NONZERO':
                    currentPath.fillRule = 'nonzero';
                    break;

                case 'FILL_RULE_EVENODD':
                    currentPath.fillRule = 'evenodd';
                    break;

                case 'NEW_PATH':
                    // Save current path if it has content
                    if (currentPath.pathData.trim()) {
                        paths.push(currentPath);
                    }
                    // Start a new path, preserving fill rule
                    currentPath = { pathData: '', color: null, fillRule: currentPath.fillRule };
                    break;

                case 'MOVE_TO':
                    currentX = args[0];
                    currentY = args[1];
                    currentPath.pathData += `M ${args[0]} ${args[1]} `;
                    break;

                case 'R_MOVE_TO':
                    currentX += args[0];
                    currentY += args[1];
                    currentPath.pathData += `m ${args[0]} ${args[1]} `;
                    break;

                case 'LINE_TO':
                    currentX = args[0];
                    currentY = args[1];
                    currentPath.pathData += `L ${args[0]} ${args[1]} `;
                    break;

                case 'R_LINE_TO':
                    currentX += args[0];
                    currentY += args[1];
                    currentPath.pathData += `l ${args[0]} ${args[1]} `;
                    break;

                case 'H_LINE_TO':
                    currentX = args[0];
                    currentPath.pathData += `H ${args[0]} `;
                    break;

                case 'R_H_LINE_TO':
                    currentX += args[0];
                    currentPath.pathData += `h ${args[0]} `;
                    break;

                case 'V_LINE_TO':
                    currentY = args[0];
                    currentPath.pathData += `V ${args[0]} `;
                    break;

                case 'R_V_LINE_TO':
                    currentY += args[0];
                    currentPath.pathData += `v ${args[0]} `;
                    break;

                case 'CUBIC_TO':
                    currentX = args[4];
                    currentY = args[5];
                    currentPath.pathData += `C ${args[0]} ${args[1]}, ${args[2]} ${args[3]}, ${args[4]} ${args[5]} `;
                    break;

                case 'R_CUBIC_TO':
                    currentX += args[4];
                    currentY += args[5];
                    currentPath.pathData += `c ${args[0]} ${args[1]}, ${args[2]} ${args[3]}, ${args[4]} ${args[5]} `;
                    break;

                case 'QUADRATIC_BEZIER_TO':
                    currentX = args[2];
                    currentY = args[3];
                    currentPath.pathData += `Q ${args[0]} ${args[1]}, ${args[2]} ${args[3]} `;
                    break;

                case 'R_QUADRATIC_BEZIER_TO':
                    currentX += args[2];
                    currentY += args[3];
                    currentPath.pathData += `q ${args[0]} ${args[1]}, ${args[2]} ${args[3]} `;
                    break;

                case 'ARC_TO':
                    // ARC_TO: rx, ry, rotation, largeArc, sweep, x, y
                    currentX = args[5];
                    currentY = args[6];
                    currentPath.pathData += `A ${args[0]} ${args[1]} ${args[2]} ${args[3]} ${args[4]} ${args[5]} ${args[6]} `;
                    break;

                case 'R_ARC_TO':
                    // R_ARC_TO: rx, ry, rotation, largeArc, sweep, dx, dy
                    currentX += args[5];
                    currentY += args[6];
                    currentPath.pathData += `a ${args[0]} ${args[1]} ${args[2]} ${args[3]} ${args[4]} ${args[5]} ${args[6]} `;
                    break;

                case 'CIRCLE':
                    // Draw circle using two arcs
                    const cx = args[0];
                    const cy = args[1];
                    const r = args[2];
                    currentPath.pathData += `M ${cx - r} ${cy} `;
                    currentPath.pathData += `a ${r} ${r} 0 1 0 ${r * 2} 0 `;
                    currentPath.pathData += `a ${r} ${r} 0 1 0 ${-r * 2} 0 `;
                    currentX = cx - r;
                    currentY = cy;
                    break;

                case 'CLOSE':
                    currentPath.pathData += 'Z ';
                    break;

                default:
                    if (command !== 'FILL_RULE_NONZERO' && command !== 'FILL_RULE_EVENODD') {
                        console.warn(`Unknown command: ${command}`);
                    }
            }
        }

        // Don't forget the last path
        if (currentPath.pathData.trim()) {
            paths.push(currentPath);
        }

        return paths;
    }

    render(canvas, options = {}) {
        const size = options.size || 200;
        const defaultColor = options.color || '#000000';
        const background = options.background || 'transparent';

        // Clear the canvas container and create SVG
        const container = canvas.parentElement;
        
        // Remove old SVG if exists
        const oldSvg = container.querySelector('svg');
        if (oldSvg) {
            oldSvg.remove();
        }

        // Hide canvas
        canvas.style.display = 'none';

        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${this.canvasDimensions} ${this.canvasDimensions}`);
        svg.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        svg.style.borderRadius = '4px';

        // Set background
        if (background !== 'transparent') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', this.canvasDimensions);
            rect.setAttribute('height', this.canvasDimensions);
            rect.setAttribute('fill', background);
            svg.appendChild(rect);
        } else {
            svg.style.background = 'white';
        }

        // Get all paths with their colors
        const paths = this.toSVGPaths();

        // Create path elements
        for (const pathData of paths) {
            if (pathData.pathData.trim()) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData.pathData.trim());
                // Use the path's color if specified, otherwise use the default color from picker
                path.setAttribute('fill', pathData.color || defaultColor);
                path.setAttribute('fill-rule', pathData.fillRule);
                svg.appendChild(path);
            }
        }

        // Add to container
        container.appendChild(svg);

        return this;
    }

    getInfo() {
        return {
            canvasDimensions: this.canvasDimensions,
            commandCount: this.commands.length,
            commands: this.commands.map(c => c.command)
        };
    }
}

// Application logic
class SkiaIconApp {
    constructor() {
        this.parser = new SkiaIconParser();
        this.currentContent = '';
        this.initializeElements();
        this.attachEventListeners();
        this.loadSampleIcon();
    }

    initializeElements() {
        this.canvas = document.getElementById('preview-canvas');
        this.fileInput = document.getElementById('file-input');
        this.textArea = document.getElementById('icon-content');
        this.parseBtn = document.getElementById('parse-btn');
        this.sizeSlider = document.getElementById('size-slider');
        this.sizeValue = document.getElementById('size-value');
        this.bgSelect = document.getElementById('bg-select');
        this.colorPicker = document.getElementById('color-picker');
        this.canvasContainer = document.getElementById('canvas-container');
        this.exampleButtons = document.querySelectorAll('[data-example]');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.parseBtn.addEventListener('click', () => this.renderIcon());
        this.sizeSlider.addEventListener('input', (e) => this.handleSizeChange(e));
        this.bgSelect.addEventListener('change', () => this.renderIcon());
        this.colorPicker.addEventListener('change', () => this.renderIcon());
        
        // Add listeners for example buttons
        this.exampleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const examplePath = e.target.getAttribute('data-example');
                this.loadExample(examplePath);
            });
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const content = await file.text();
            this.textArea.value = content;
            this.currentContent = content;
            this.renderIcon();
        }
    }

    handleSizeChange(event) {
        const size = event.target.value;
        this.sizeValue.textContent = size;
        this.renderIcon();
    }

    renderIcon() {
        const content = this.textArea.value || this.currentContent;
        if (!content.trim()) {
            alert('Please provide icon content');
            return;
        }

        try {
            this.parser.parse(content);
            
            const options = {
                size: parseInt(this.sizeSlider.value),
                color: this.colorPicker.value,
                background: this.bgSelect.value
            };

            this.parser.render(this.canvas, options);
            this.canvasContainer.style.display = 'flex';
        } catch (error) {
            alert('Error parsing icon: ' + error.message);
            console.error(error);
        }
    }

    async loadSampleIcon() {
        try {
            const response = await fetch('example.icon');
            if (response.ok) {
                const content = await response.text();
                this.currentContent = content;
                this.textArea.value = content;
                this.renderIcon();
            }
        } catch (error) {
            console.log('No sample icon found');
        }
    }

    async loadExample(path) {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const content = await response.text();
                this.currentContent = content;
                this.textArea.value = content;
                this.renderIcon();
            } else {
                alert('Could not load example icon');
            }
        } catch (error) {
            alert('Error loading example: ' + error.message);
            console.error(error);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SkiaIconApp();
});
