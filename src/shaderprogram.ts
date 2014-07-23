declare var gl: WebGLRenderingContext;

// Simple shader class for easy loading (from DOM) and disposing.
class ShaderProgram {
    program: WebGLProgram;
    private vertexShader: WebGLShader;
    private fragmentShader: WebGLShader;

    // Constructs shader from DOM script ids. Throws an error message if something went wrong. 
    constructor(vertexShaderID: string, fragmentShaderID: string) {
        this.vertexShader = this.getShaderFromDOM(vertexShaderID);
        this.fragmentShader = this.getShaderFromDOM(fragmentShaderID);

        this.program = gl.createProgram();
        gl.attachShader(this.program, this.vertexShader);
        gl.attachShader(this.program, this.fragmentShader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw "Error linking shader (vs:" + vertexShaderID + " ps: " + fragmentShaderID + "): " + gl.getProgramInfoLog(this.program);
        }
    }

    // Destroys shader and program.
    dispose() {
        gl.deleteShader(this.vertexShader);
        this.vertexShader = null;
        gl.deleteShader(this.fragmentShader);
        this.fragmentShader = null;
        gl.deleteProgram(this.program);
        this.program = null;
    }

    // Retrieves shader from DOM. Throws an error message if something went wrong.
    private getShaderFromDOM(id: string): WebGLShader {
        var shaderScript = <HTMLScriptElement>document.getElementById(id);
        if (!shaderScript) {
            throw "Couldn't get shader script from document! (" + id + ")";
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3)
                str += k.textContent;
            k = k.nextSibling;
        }

        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            throw "Unkown shader type: " + shaderScript.type;
        }

        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw "Error compiling shader (" + id + "): " + gl.getShaderInfoLog(shader);
        }

        return shader;
    }
} 