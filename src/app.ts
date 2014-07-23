/// <reference path="rendering.ts" />
/// <reference path="simulation.ts" />

var gl: WebGLRenderingContext;
var TARGET_FRAMETIME: number = 1 / 60;

class Application {
    private canvas: HTMLCanvasElement;

    private lastFrameTime: number;
    private renderModule: Rendering;
    private simulationModule: Simulation;

    constructor() {
        // Exchange timestamp function if window.performance not available.
        if (!window.performance || !window.performance.now)
            this.getTimestamp = () => { return new Date().getTime() };

        this.canvas = <HTMLCanvasElement>document.getElementById("canvas");

        gl = <WebGLRenderingContext>this.canvas.getContext("experimental-webgl");

        if (gl.getExtension("OES_texture_float") == null) {
            throw "Float textures are not supported! (OES_texture_float support missing)";
        }
        if (gl.getExtension("OES_texture_float_linear") == null) {
            throw "Float textures are not supported! (OES_texture_float_linear support missing)";
        }

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.TEXTURE);

        this.lastFrameTime = 0;

        this.renderModule = new Rendering();
        this.simulationModule = new Simulation(this.canvas.width, this.canvas.height);
    }

    dispose() {
        this.renderModule.dispose();
        this.simulationModule.dispose();
        gl.canvas.width = 1;
        gl.canvas.height = 1;
    }
 
    run() {
        var now = this.getTimestamp();
        var timeSinceLastFrame = (now - this.lastFrameTime) / 1000;    // duration in seconds

        if (timeSinceLastFrame > TARGET_FRAMETIME) {
            this.simulationModule.update(TARGET_FRAMETIME);

            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            this.renderModule.render(this.simulationModule.getVelocityTexture());

            this.lastFrameTime = now;
        }

        requestAnimationFrame(() => this.run());
    }

    private getTimestamp() {
        return window.performance.now();
    }
}


var application: Application;

window.onload = () => {
    application = new Application();
    requestAnimationFrame(() => application.run());
};

window.onunload = () => {
    application.dispose();
    application = null;
}
