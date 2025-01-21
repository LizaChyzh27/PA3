'use strict';

let gl;                         // Контекст WebGL
let surface;                    // Модель поверхні
let shProgram;                  // Програма шейдерів
let spaceball;                  // TrackballRotator для обертання вигляду

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Конструктор моделі
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.count = 0;

    // Запис даних у буфери
    this.BufferData = function(data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normalList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indexList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoordList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.tangentList), gl.STATIC_DRAW);

        this.count = data.indexList.length;
    };

    // Малювання моделі
    this.Draw = function() {
        // Вершини
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        // Нормалі
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        // Тангенси
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        // Текстурні координати
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

        // Індекси
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
}

// Конструктор програми шейдерів
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribTexCoord = gl.getAttribLocation(this.prog, 'texCoord');
    this.iModelViewProjectionMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    };
}

// Функція малювання
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Створюємо перспективну матрицю для камери
    let projection = m4.perspective(Math.PI / 8, 1, 1, 60);  // Використовуємо перспективу з кутом 22.5° (Math.PI / 8)

    // Отримуємо матрицю виду, яка описує позицію камери в сцені
    let modelView = spaceball.getViewMatrix();  // Оновлюємо позицію камери з допомогою "spaceball"

    // Створюємо матрицю повороту для обертання об'єкта
    let rotateToPointZero = m4.axisRotation([1, 0.5, 0.5], -Math.PI / 3);  

    // Створюємо матрицю переміщення на -50 одиниць по осі Z
    let translateToPointZero = m4.translation(0, 0, -50);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);  

    let matAccum1 = m4.multiply(translateToPointZero, matAccum0); 

    // Створюємо матрицю моделі-вигляду-презентації для застосування перспективи
    let modelViewProjection = m4.multiply(projection, matAccum1); 
    let normalMatrix = calculateNormalMatrix(matAccum1);

    // Відправляємо обчислену матрицю моделі-вигляду-презентації до шейдера
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    // Відправляємо матрицю моделі-вигляду без перспективи до шейдера для використання в інших обчисленнях
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);
    // Оновлення позиції світла
    const time = performance.now();
    const lightPosition = updateLightPosition(time);
    
    // Параметрів освітлення
    const ambientStrength = 0.1; // Сила ambient освітлення
    const specularStrength = 0.5; // Сила спекулярного освітлення
    const shininess = 32.0; // Жорсткість поверхні

    // Позиція спостерігача (камери)
    const viewPosition = [0.0, 0.0, 30.0]; // Камера знаходиться за об'єктом

    // Передача параметрів в шейдер
    gl.uniform3fv(shProgram.iLightPosition, lightPosition);
    gl.uniform3fv(shProgram.iViewPosition, viewPosition);
    gl.uniform1f(shProgram.iAmbientStrength, ambientStrength);
    gl.uniform1f(shProgram.iSpecularStrength, specularStrength);
    gl.uniform1f(shProgram.iShininess, shininess);
    // Малювання поверхні
    const surfaceColor = [1.0, 0.1, 0.0, 1.0];
    gl.uniform4fv(shProgram.iColor, surfaceColor);
    surface.Draw();
}

// Оновлення позиції світла на основі часу
function updateLightPosition(time) {
    const angle = time * 0.001; // Швидкість обертання
    const radius = 5; // Радіус обертання світла
    const height = 10; // Висота над фігурою

    // Рух по колу в площині XZ на фіксованій висоті Y
    const x = radius * Math.cos(angle);
    const y = height;
    const z = radius * Math.sin(angle) - 50; 
    return [x, y, z];
}

// Розрахунок матриці нормалей
function calculateNormalMatrix(modelViewMatrix) {
    const normalMatrix = m4.inverse(modelViewMatrix);
    return m4.transpose(normalMatrix);
}

// Функція створення поверхні
function CreateSurfaceData(uSteps, vSteps) {
    const vertexList = [];
    const normalList = [];
    const tangentList = [];
    const indexList = [];
    const texCoordList = [];

    const uMin = -2.0, uMax = 2.0;
    const vMin = -2.0, vMax = 2.0;
    const uStep = (uMax - uMin) / uSteps;
    const vStep = (vMax - vMin) / vSteps;

    for (let i = 0; i <= vSteps; i++) {
        for (let j = 0; j <= uSteps; j++) {
            const u = uMin + j * uStep;
            const v = vMin + i * vStep;

            const x = (1 / 3) * Math.pow(u, 3) - u * Math.pow(v, 2) + u / (u * u + v * v);
            const y = -Math.pow(u, 2) * v + (1 / 3) * Math.pow(v, 3) - v / (u * u + v * v);
            const z = 2 * u;

            vertexList.push(x, y, z);
            
            // Дотичні та нормалі
            const du = [
                x + (1 / 3) * Math.pow(u + uStep, 3) - (u + uStep) * Math.pow(v, 2) + (u + uStep) / ((u + uStep) ** 2 + v ** 2) - x,
                y - Math.pow((u + uStep), 2) * v + (1 / 3) * Math.pow(v, 3) - v / ((u + uStep) ** 2 + v ** 2) - y,
                z + 2 * (u + uStep) - z,
            ];
            const dv = [
                x + (1 / 3) * Math.pow(u, 3) - u * Math.pow(v + vStep, 2) + u / (u ** 2 + (v + vStep) ** 2) - x,
                y - Math.pow(u, 2) * (v + vStep) + (1 / 3) * Math.pow((v + vStep), 3) - (v + vStep) / (u ** 2 + (v + vStep) ** 2) - y,
                z + 2 * u - z,
            ];
            const normal = normalize(cross(du, dv));

            normalList.push(...normal);
            tangentList.push(...normalize(du));

            texCoordList.push(j / uSteps, i / vSteps);
        }
    }

    for (let i = 0; i < vSteps; i++) {
        for (let j = 0; j < uSteps; j++) {
            const idx1 = i * (uSteps + 1) + j;
            const idx2 = idx1 + 1;
            const idx3 = idx1 + (uSteps + 1);
            const idx4 = idx3 + 1;

            indexList.push(idx1, idx2, idx3, idx2, idx4, idx3);
        }
    }

    return { vertexList, normalList, tangentList, indexList, texCoordList };
}
// Нормалізація вектора
function normalize(vector) {
    const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
    if (length === 0) return [0, 0, 0];
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

// Векторний добуток
function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

let lastTime = 0; 
const fps = 30; // Бажана частота кадрів
const interval = 1000 / fps; 

// Контроль за частотою кадрів
function drawWithFrameControl(time) {
    const deltaTime = time - lastTime;
    if (deltaTime >= interval) { 
        lastTime = time - (deltaTime % interval); 
        draw(); 
    }

    requestAnimationFrame(drawWithFrameControl); 
}

// Ініціалізація та запуск анімації
function startAnimation() {
    requestAnimationFrame(drawWithFrameControl); // Запускаємо цикл анімації
}

// Оновлення поверхні
function updateSurface() {
    // Отримання значень з повзунків і перетворення їх на цілі числа
    const uSteps = parseInt(document.getElementById('uGranularity').value, 10);
    const vSteps = parseInt(document.getElementById('vGranularity').value, 10);

    // Перевірка на валідність значень
    if (isNaN(uSteps) || isNaN(vSteps) || uSteps <= 0 || vSteps <= 0) {
        console.error("Invalid granularity values: uSteps or vSteps must be positive integers.");
        return;
    }

    // Створення нових даних для поверхні
    const data = CreateSurfaceData(uSteps, vSteps);

    // Оновлення буферів WebGL
    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normalList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, surface.iIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indexList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoordList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iTangentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.tangentList), gl.STATIC_DRAW);

    // Оновлення кількості індексів
    surface.count = data.indexList.length;

    // Перемальовування сцени
    draw();
}

// Завантаження текстури
function loadTexture(gl, imageUrl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Встановлюємо параметри текстури
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const img = new Image();
    img.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        console.log(`Texture loaded: ${imageUrl}`);
    };
    img.onerror = function() {
        console.error("Failed to load image: " + imageUrl);
    };
    img.src = imageUrl;

    return texture;
}

function initGL() {
    // Створення програми шейдерів
    const prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!prog) {
        console.error("Не вдалося створити шейдерну програму");
        return;
    }

    // Завантаження текстур
    const diffuseMap = loadTexture(gl, 'diffuse.png');
    const specularMap = loadTexture(gl, 'specular.png');
    const normalMap = loadTexture(gl, 'normal.png');
    if (!diffuseMap || !specularMap || !normalMap) {
        console.error("Не вдалося завантажити текстури");
        return;
    }

    // Ініціалізація шейдерної програми
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    // Зв'язування атрибутів та юніформів
    shProgram.iAttribVertex = gl.getAttribLocation(prog, 'vertex');
    shProgram.iAttribNormal = gl.getAttribLocation(prog, 'normal');
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, 'ModelViewProjectionMatrix');
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, 'ModelViewMatrix');
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, 'NormalMatrix');
    shProgram.iAttribTangent = gl.getAttribLocation(prog, 'tangent');
    shProgram.iColor = gl.getUniformLocation(prog, 'color');
    shProgram.iLightPosition = gl.getUniformLocation(prog, 'lightPosition');
    shProgram.iViewPosition = gl.getUniformLocation(prog, 'viewPosition');
    shProgram.iAmbientStrength = gl.getUniformLocation(prog, 'ambientStrength');
    shProgram.iSpecularStrength = gl.getUniformLocation(prog, 'specularStrength');
    shProgram.iShininess = gl.getUniformLocation(prog, 'shininess');

    // Перевірка юніформів текстур
    const diffuseLocation = gl.getUniformLocation(prog, 'diffuseMap');
    const specularLocation = gl.getUniformLocation(prog, 'specularMap');
    const normalLocation = gl.getUniformLocation(prog, 'normalMap');

    if (!diffuseLocation || !specularLocation || !normalLocation) {
        console.error("Юніформи текстур не знайдено");
        return;
    }

    // Прив'язка текстур
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseMap);
    gl.uniform1i(diffuseLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularMap);
    gl.uniform1i(specularLocation, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalMap);
    gl.uniform1i(normalLocation, 2);

    // Ініціалізація моделі
    surface = new Model('Surface');
    const surfaceData = CreateSurfaceData(50, 50);
    if (!surfaceData) {
        console.error("Не вдалося створити дані поверхні");
        return;
    }
    surface.BufferData(surfaceData);

    // Увімкнення глибини
    gl.enable(gl.DEPTH_TEST);
}

// Створення програми шейдерів
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error('Помилка компіляції шейдера вершин: ' + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error('Помилка компіляції шейдера фрагментів: ' + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Помилка лінкування програми: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

// Ініціалізація
function init() {
    let canvas;
    try {
        canvas = document.getElementById('webglcanvas');
        gl = canvas.getContext('webgl');
        if (!gl) {
            throw 'Браузер не підтримує WebGL';
        }
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML =
            '<p>Перепрошуємо, не вдалося отримати контекст WebGL.</p>';
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML =
            '<p>Перепрошуємо, не вдалося ініціалізувати контекст WebGL: ' + e + '</p>';
        return;
    }
    spaceball = new TrackballRotator(canvas, draw, 0);
    startAnimation();
}
