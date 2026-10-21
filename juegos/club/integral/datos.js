/* Integrodle: el banco de integrales. Solo datos, sin DOM.
   UMD: `IntegralDatos` en la página, `module.exports` en Node.

   Cada ficha:
     id  estable, nunca se reusa ni se cambia (el del día sale de aquí)
     t   la técnica principal (TECNICAS)
     d   dificultad 1–3
     f   el integrando, en la sintaxis de expr.js
     F   una primitiva (la que se muestra en la solución)
     r   [a, b]: donde se compara (la primitiva tiene que ser continua y
         real en todo el tramo) o, si `def`, los límites de la integral
     v   (solo `def`) el valor exacto, que se muestra en la solución
     p   el paso clave, en LaTeX: la segunda pista

   tests/integral.test.cjs comprueba cada ficha: que F' = f en el tramo,
   que F(b) − F(a) = v en las definidas, y que todo se pueda leer.

   OJO: el objetivo de un día pasado sale de esta lista tal como está hoy,
   y el verificador antitrampas rehace con ella todo el historial de cada
   cuenta. Una ficha nueva va AL FINAL y con `desde: "AAAA-MM-DD"`; nunca
   se borra ni se reordena una. Corregir el integrando de una que ya salió
   rechazaría los días en que se acertó: si hace falta, se agrega otra y la
   vieja se marca `hasta`. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.IntegralDatos = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const R = String.raw;

  const TECNICAS = {
    sust: { n: "Cambio de variable", c: "u", d: "Busca una función cuya derivada también aparezca (salvo una constante) y llámala u." },
    partes: { n: "Integración por partes", c: "∂", d: R`∫u dv = uv − ∫v du. Elige u con LIATE: logaritmos, inversas trigonométricas, algebraicas, trigonométricas, exponenciales.` },
    fracc: { n: "Fracciones parciales", c: "⅟", d: "Factoriza el denominador y separa en fracciones simples (si el grado del numerador no es menor, divide primero)." },
    trigsust: { n: "Sustitución trigonométrica", c: "θ", d: "√(a²−x²): x = a sen θ · √(a²+x²): x = a tan θ · √(x²−a²): x = a sec θ." },
    trig: { n: "Identidades trigonométricas", c: "∿", d: "Potencias de seno y coseno, sec y tan, producto a suma: reescribe con identidades antes de integrar." },
    cuad: { n: "Completar el cuadrado", c: "²", d: "Lleva el cuadrático a (x+h)² ± k² y termina con arctan, arcsen o un logaritmo." },
    weier: { n: "Sustitución t = tan(x/2)", c: "t", d: "sen x = 2t/(1+t²), cos x = (1−t²)/(1+t²), dx = 2 dt/(1+t²): queda una racional en t." },
    raiz: { n: "Racionalizar con una raíz", c: "√", d: "Llama u a la raíz (o a la raíz común de índice mínimo) para que desaparezca." }
  };

  const BANCO = [
    /* ---------- cambio de variable ---------- */
    { id: "i001", t: "sust", d: 1, f: "x exp(x^2)", F: "exp(x^2)/2", r: ["-1", "1"], p: R`u = x^2,\quad du = 2x\,dx` },
    { id: "i002", t: "sust", d: 1, f: "sin(x) cos(x)^3", F: "-cos(x)^4/4", r: ["0", "3"], p: R`u = \cos x,\quad du = -\sin x\,dx` },
    { id: "i003", t: "sust", d: 1, f: "ln(x)/x", F: "ln(x)^2/2", r: ["0.5", "4"], p: R`u = \ln x,\quad du = \frac{dx}{x}` },
    { id: "i004", t: "sust", d: 1, f: "1/(x ln(x))", F: "ln(ln(x))", r: ["1.5", "5"], p: R`u = \ln x \;\Rightarrow\; \int \frac{du}{u}` },
    { id: "i005", t: "sust", d: 1, f: "x/sqrt(1-x^2)", F: "-sqrt(1-x^2)", r: ["-0.9", "0.9"], p: R`u = 1 - x^2,\quad du = -2x\,dx` },
    { id: "i006", t: "sust", d: 2, f: "exp(sqrt(x))/sqrt(x)", F: "2 exp(sqrt(x))", r: ["0.2", "4"], p: R`u = \sqrt{x},\quad du = \frac{dx}{2\sqrt{x}}` },
    { id: "i007", t: "sust", d: 1, f: "tan(x)", F: "-ln(cos(x))", r: ["-1.2", "1.2"], p: R`\tan x = \frac{\sin x}{\cos x},\quad u = \cos x` },
    { id: "i008", t: "sust", d: 1, f: "x^2 sqrt(x^3+1)", F: "2/9 (x^3+1)^(3/2)", r: ["0", "2"], p: R`u = x^3 + 1,\quad du = 3x^2\,dx` },
    { id: "i009", t: "sust", d: 2, f: "exp(x)/(1+exp(2x))", F: "arctan(exp(x))", r: ["-2", "2"], p: R`u = e^x \;\Rightarrow\; \int \frac{du}{1+u^2}` },
    { id: "i010", t: "sust", d: 2, f: "sin(sqrt(x))/sqrt(x)", F: "-2 cos(sqrt(x))", r: ["0.1", "9"], p: R`u = \sqrt{x},\quad 2\,du = \frac{dx}{\sqrt{x}}` },
    { id: "i011", t: "sust", d: 1, f: "cos(ln(x))/x", F: "sin(ln(x))", r: ["0.2", "5"], p: R`u = \ln x,\quad du = \frac{dx}{x}` },
    { id: "i012", t: "sust", d: 1, f: "(2x+3)/(x^2+3x+5)", F: "ln(x^2+3x+5)", r: ["-3", "3"], p: R`u = x^2 + 3x + 5,\quad du = (2x+3)\,dx` },
    { id: "i013", t: "sust", d: 1, f: "sec(x)^2 tan(x)^3", F: "tan(x)^4/4", r: ["-1.2", "1.2"], p: R`u = \tan x,\quad du = \sec^2 x\,dx` },
    { id: "i014", t: "sust", d: 2, f: "x/(x^4+1)", F: "arctan(x^2)/2", r: ["-2", "2"], p: R`u = x^2 \;\Rightarrow\; \frac{1}{2}\int \frac{du}{1+u^2}` },
    { id: "i015", t: "sust", d: 2, f: "1/(x (1+ln(x)^2))", F: "arctan(ln(x))", r: ["0.2", "5"], p: R`u = \ln x \;\Rightarrow\; \int \frac{du}{1+u^2}` },
    { id: "i016", t: "sust", d: 1, f: "exp(x) sqrt(1+exp(x))", F: "2/3 (1+exp(x))^(3/2)", r: ["-2", "2"], p: R`u = 1 + e^x,\quad du = e^x\,dx` },
    { id: "i017", t: "sust", d: 1, f: "x sin(x^2)", F: "-cos(x^2)/2", r: ["-2", "2"], p: R`u = x^2,\quad du = 2x\,dx` },
    { id: "i018", t: "sust", d: 2, f: "sin(2x)/(1+cos(x)^2)", F: "-ln(1+cos(x)^2)", r: ["-3", "3"], p: R`\sin 2x = 2\sin x\cos x,\quad u = 1 + \cos^2 x` },
    { id: "i019", t: "sust", d: 1, f: "arctan(x)/(1+x^2)", F: "arctan(x)^2/2", r: ["-3", "3"], p: R`u = \arctan x,\quad du = \frac{dx}{1+x^2}` },
    { id: "i020", t: "sust", d: 2, f: "1/(sqrt(x) (1+x))", F: "2 arctan(sqrt(x))", r: ["0.1", "9"], p: R`u = \sqrt{x} \;\Rightarrow\; 2\int \frac{du}{1+u^2}` },
    { id: "i021", t: "sust", d: 1, f: "arcsin(x)/sqrt(1-x^2)", F: "arcsin(x)^2/2", r: ["-0.9", "0.9"], p: R`u = \arcsin x,\quad du = \frac{dx}{\sqrt{1-x^2}}` },
    { id: "i022", t: "sust", d: 1, f: "x^3 exp(-x^4)", F: "-exp(-x^4)/4", r: ["-1.5", "1.5"], p: R`u = -x^4,\quad du = -4x^3\,dx` },
    { id: "i023", t: "sust", d: 2, f: "exp(1/x)/x^2", F: "-exp(1/x)", r: ["0.3", "3"], p: R`u = \frac{1}{x},\quad du = -\frac{dx}{x^2}` },
    { id: "i024", t: "sust", d: 1, f: "cos(x)/sqrt(sin(x))", F: "2 sqrt(sin(x))", r: ["0.2", "2.9"], p: R`u = \sin x,\quad du = \cos x\,dx` },
    { id: "i025", t: "sust", d: 2, def: true, f: "x sqrt(x+1)", F: "2/5 (x+1)^(5/2) - 2/3 (x+1)^(3/2)", r: ["0", "3"], v: "116/15", p: R`u = x + 1:\; \int_1^4 (u-1)\sqrt{u}\,du` },

    /* ---------- por partes ---------- */
    { id: "i026", t: "partes", d: 1, f: "x exp(x)", F: "(x-1) exp(x)", r: ["-2", "2"], p: R`u = x,\quad dv = e^x\,dx` },
    { id: "i027", t: "partes", d: 2, f: "x^2 exp(x)", F: "(x^2-2x+2) exp(x)", r: ["-2", "2"], p: R`u = x^2,\; dv = e^x\,dx \text{ (dos veces)}` },
    { id: "i028", t: "partes", d: 1, f: "x cos(x)", F: "x sin(x) + cos(x)", r: ["-3", "3"], p: R`u = x,\quad dv = \cos x\,dx` },
    { id: "i029", t: "partes", d: 2, f: "x^2 sin(x)", F: "-x^2 cos(x) + 2x sin(x) + 2cos(x)", r: ["-3", "3"], p: R`u = x^2,\; dv = \sin x\,dx \text{ (dos veces)}` },
    { id: "i030", t: "partes", d: 1, f: "ln(x)", F: "x ln(x) - x", r: ["0.3", "5"], p: R`u = \ln x,\quad dv = dx` },
    { id: "i031", t: "partes", d: 1, f: "x ln(x)", F: "x^2/2 ln(x) - x^2/4", r: ["0.3", "5"], p: R`u = \ln x,\quad dv = x\,dx` },
    { id: "i032", t: "partes", d: 2, f: "arctan(x)", F: "x arctan(x) - ln(1+x^2)/2", r: ["-3", "3"], p: R`u = \arctan x,\quad dv = dx` },
    { id: "i033", t: "partes", d: 2, f: "arcsin(x)", F: "x arcsin(x) + sqrt(1-x^2)", r: ["-0.9", "0.9"], p: R`u = \arcsin x,\quad dv = dx` },
    { id: "i034", t: "partes", d: 2, f: "exp(x) sin(x)", F: "exp(x) (sin(x) - cos(x))/2", r: ["-2", "2"], p: R`\text{Dos veces por partes y despeja la integral (cíclica)}` },
    { id: "i035", t: "partes", d: 3, f: "exp(2x) cos(x)", F: "exp(2x) (2cos(x) + sin(x))/5", r: ["-2", "2"], p: R`\text{Cíclica: dos veces por partes; vuelve a aparecer } -\tfrac14\,I` },
    { id: "i036", t: "partes", d: 2, f: "ln(x)^2", F: "x ln(x)^2 - 2x ln(x) + 2x", r: ["0.3", "5"], p: R`u = \ln^2 x,\; dv = dx \;\Rightarrow\; -2\int \ln x\,dx` },
    { id: "i037", t: "partes", d: 2, f: "x sec(x)^2", F: "x tan(x) + ln(cos(x))", r: ["-1.2", "1.2"], p: R`u = x,\quad dv = \sec^2 x\,dx` },
    { id: "i038", t: "partes", d: 3, f: "x^3 exp(x^2)", F: "(x^2-1) exp(x^2)/2", r: ["-1.5", "1.5"], p: R`w = x^2 \text{ y luego } u = w,\; dv = e^w\,dw` },
    { id: "i039", t: "partes", d: 3, f: "sin(ln(x))", F: "x (sin(ln(x)) - cos(ln(x)))/2", r: ["0.3", "5"], p: R`u = \sin(\ln x),\; dv = dx \text{ (cíclica)}` },
    { id: "i040", t: "partes", d: 2, f: "x arctan(x)", F: "(x^2+1)/2 arctan(x) - x/2", r: ["-3", "3"], p: R`u = \arctan x,\quad dv = x\,dx` },
    { id: "i041", t: "partes", d: 2, f: "ln(x)/x^2", F: "-(ln(x)+1)/x", r: ["0.3", "5"], p: R`u = \ln x,\quad dv = \frac{dx}{x^2}` },
    { id: "i042", t: "partes", d: 1, f: "x^2 ln(x)", F: "x^3/3 ln(x) - x^3/9", r: ["0.3", "4"], p: R`u = \ln x,\quad dv = x^2\,dx` },
    { id: "i043", t: "partes", d: 3, f: "ln(x^2+1)", F: "x ln(x^2+1) - 2x + 2arctan(x)", r: ["-3", "3"], p: R`u = \ln(x^2+1),\; dv = dx \;\Rightarrow\; \int \frac{2x^2}{x^2+1}\,dx` },
    { id: "i044", t: "partes", d: 3, f: "exp(sqrt(x))", F: "2 (sqrt(x)-1) exp(sqrt(x))", r: ["0.1", "9"], p: R`w = \sqrt{x}:\; 2\int w\,e^w\,dw` },
    { id: "i045", t: "partes", d: 2, f: "cos(x) ln(sin(x))", F: "sin(x) ln(sin(x)) - sin(x)", r: ["0.2", "2.9"], p: R`w = \sin x:\; \int \ln w\,dw` },
    { id: "i046", t: "partes", d: 1, def: true, f: "x sin(x)", F: "sin(x) - x cos(x)", r: ["0", "pi"], v: "pi", p: R`u = x,\quad dv = \sin x\,dx` },
    { id: "i047", t: "partes", d: 1, def: true, f: "ln(x)", F: "x ln(x) - x", r: ["1", "e"], v: "1", p: R`u = \ln x,\quad dv = dx` },
    { id: "i048", t: "partes", d: 2, f: "exp(-x) cos(x)", F: "exp(-x) (sin(x) - cos(x))/2", r: ["-2", "2"], p: R`\text{Cíclica: dos veces por partes y despeja}` },
    { id: "i049", t: "partes", d: 2, def: true, f: "arctan(x)", F: "x arctan(x) - ln(1+x^2)/2", r: ["0", "1"], v: "pi/4 - ln(2)/2", p: R`u = \arctan x,\quad dv = dx` },
    { id: "i050", t: "partes", d: 3, f: "x ln(x+1)", F: "(x^2-1)/2 ln(x+1) - x^2/4 + x/2", r: ["0", "4"], p: R`u = \ln(x+1),\; dv = x\,dx \;\Rightarrow\; \frac{x^2}{x+1} = x - 1 + \frac{1}{x+1}` },

    /* ---------- fracciones parciales ---------- */
    { id: "i051", t: "fracc", d: 1, f: "1/(x^2-1)", F: "ln((x-1)/(x+1))/2", r: ["1.5", "5"], p: R`\frac{1}{x^2-1} = \frac{1/2}{x-1} - \frac{1/2}{x+1}` },
    { id: "i052", t: "fracc", d: 1, f: "(3x+5)/((x+1)(x+2))", F: "2ln(x+1) + ln(x+2)", r: ["0", "4"], p: R`\frac{3x+5}{(x+1)(x+2)} = \frac{2}{x+1} + \frac{1}{x+2}` },
    { id: "i053", t: "fracc", d: 1, f: "1/(x (x+1))", F: "ln(x/(x+1))", r: ["0.5", "5"], p: R`\frac{1}{x(x+1)} = \frac{1}{x} - \frac{1}{x+1}` },
    { id: "i054", t: "fracc", d: 3, f: "(x^2+1)/(x (x-1)^2)", F: "ln(x) - 2/(x-1)", r: ["1.5", "5"], p: R`\frac{A}{x} + \frac{B}{x-1} + \frac{C}{(x-1)^2}:\; A = 1,\ B = 0,\ C = 2` },
    { id: "i055", t: "fracc", d: 2, f: "1/(x^3+x)", F: "ln(x) - ln(x^2+1)/2", r: ["0.5", "5"], p: R`\frac{1}{x(x^2+1)} = \frac{1}{x} - \frac{x}{x^2+1}` },
    { id: "i056", t: "fracc", d: 2, f: "(x+3)/(x^2-x-2)", F: "5/3 ln(x-2) - 2/3 ln(x+1)", r: ["3", "7"], p: R`x^2 - x - 2 = (x-2)(x+1):\; A = \tfrac{5}{3},\ B = -\tfrac{2}{3}` },
    { id: "i057", t: "fracc", d: 2, f: "x^3/(x^2-1)", F: "x^2/2 + ln(x^2-1)/2", r: ["1.5", "5"], p: R`\text{Divide primero: } \frac{x^3}{x^2-1} = x + \frac{x}{x^2-1}` },
    { id: "i058", t: "fracc", d: 1, f: "1/(x^2+2x)", F: "ln(x/(x+2))/2", r: ["0.5", "5"], p: R`\frac{1}{x(x+2)} = \frac{1/2}{x} - \frac{1/2}{x+2}` },
    { id: "i059", t: "fracc", d: 2, f: "(5x-4)/(2x^2+x-1)", F: "-ln(2x-1)/2 + 3ln(x+1)", r: ["1", "5"], p: R`2x^2 + x - 1 = (2x-1)(x+1):\; \frac{-1}{2x-1} + \frac{3}{x+1}` },
    { id: "i060", t: "fracc", d: 3, f: "1/((x+1) (x^2+1))", F: "ln(x+1)/2 - ln(x^2+1)/4 + arctan(x)/2", r: ["0", "4"], p: R`\frac{A}{x+1} + \frac{Bx + C}{x^2+1}:\; A = \tfrac12,\ B = -\tfrac12,\ C = \tfrac12` },
    { id: "i061", t: "fracc", d: 2, f: "x/(x-1)^2", F: "ln(x-1) - 1/(x-1)", r: ["1.5", "5"], p: R`\frac{x}{(x-1)^2} = \frac{1}{x-1} + \frac{1}{(x-1)^2}` },
    { id: "i062", t: "fracc", d: 1, f: "x^2/(x^2+4)", F: "x - 2arctan(x/2)", r: ["-3", "3"], p: R`\frac{x^2}{x^2+4} = 1 - \frac{4}{x^2+4}` },
    { id: "i063", t: "fracc", d: 3, f: "4/(x^4-1)", F: "ln((x-1)/(x+1)) - 2arctan(x)", r: ["1.5", "5"], p: R`\frac{4}{(x^2-1)(x^2+1)} = \frac{2}{x^2-1} - \frac{2}{x^2+1}` },
    { id: "i064", t: "fracc", d: 2, f: "(x^2+2x-1)/(x^3-x)", F: "ln(x) + ln(x-1) - ln(x+1)", r: ["1.5", "5"], p: R`\frac{A}{x} + \frac{B}{x-1} + \frac{C}{x+1}:\; A = 1,\ B = 1,\ C = -1` },
    { id: "i065", t: "fracc", d: 1, def: true, f: "1/(x^2+3x+2)", F: "ln((x+1)/(x+2))", r: ["0", "1"], v: "ln(4/3)", p: R`\frac{1}{(x+1)(x+2)} = \frac{1}{x+1} - \frac{1}{x+2}` },
    { id: "i066", t: "cuad", d: 2, f: "(2x+1)/(x^2+2x+5)", F: "ln(x^2+2x+5) - arctan((x+1)/2)/2", r: ["-4", "3"], p: R`2x + 1 = (2x+2) - 1,\quad x^2 + 2x + 5 = (x+1)^2 + 4` },
    { id: "i067", t: "cuad", d: 1, f: "1/(x^2+4x+13)", F: "arctan((x+2)/3)/3", r: ["-5", "3"], p: R`x^2 + 4x + 13 = (x+2)^2 + 9` },
    { id: "i068", t: "cuad", d: 2, f: "1/sqrt(3-2x-x^2)", F: "arcsin((x+1)/2)", r: ["-2.7", "0.7"], p: R`3 - 2x - x^2 = 4 - (x+1)^2` },
    { id: "i069", t: "fracc", d: 1, f: "1/(x^2-6x+8)", F: "ln((x-4)/(x-2))/2", r: ["5", "9"], p: R`\frac{1}{(x-2)(x-4)} = \frac{1/2}{x-4} - \frac{1/2}{x-2}` },
    { id: "i070", t: "fracc", d: 1, f: "(x^3+x+1)/(x^2+1)", F: "x^2/2 + arctan(x)", r: ["-3", "3"], p: R`\text{Divide: } \frac{x^3 + x + 1}{x^2+1} = x + \frac{1}{x^2+1}` },
    { id: "i071", t: "fracc", d: 2, f: "1/(x^2 (x+1))", F: "-ln(x) - 1/x + ln(x+1)", r: ["0.5", "5"], p: R`\frac{A}{x} + \frac{B}{x^2} + \frac{C}{x+1}:\; A = -1,\ B = 1,\ C = 1` },
    { id: "i072", t: "fracc", d: 3, f: "exp(x)/(exp(2x)-1)", F: "ln((exp(x)-1)/(exp(x)+1))/2", r: ["0.3", "3"], p: R`u = e^x \;\Rightarrow\; \int \frac{du}{u^2-1}` },
    { id: "i073", t: "fracc", d: 3, f: "cos(x)/(sin(x)^2+sin(x))", F: "ln(sin(x)/(sin(x)+1))", r: ["0.2", "2.9"], p: R`u = \sin x \;\Rightarrow\; \int \frac{du}{u(u+1)}` },
    { id: "i074", t: "fracc", d: 1, def: true, f: "(x+1)/(x^2+1)", F: "ln(x^2+1)/2 + arctan(x)", r: ["0", "1"], v: "ln(2)/2 + pi/4", p: R`\frac{x+1}{x^2+1} = \frac{x}{x^2+1} + \frac{1}{x^2+1}` },

    /* ---------- sustitución trigonométrica ---------- */
    { id: "i075", t: "trigsust", d: 3, f: "1/(x^2 sqrt(4-x^2))", F: "-sqrt(4-x^2)/(4x)", r: ["0.3", "1.9"], p: R`x = 2\sin\theta \;\Rightarrow\; \frac14\int \csc^2\theta\,d\theta` },
    { id: "i076", t: "trigsust", d: 2, f: "sqrt(1-x^2)", F: "(x sqrt(1-x^2) + arcsin(x))/2", r: ["-0.9", "0.9"], p: R`x = \sin\theta \;\Rightarrow\; \int \cos^2\theta\,d\theta` },
    { id: "i077", t: "trigsust", d: 3, f: "x^2/sqrt(9-x^2)", F: "9/2 arcsin(x/3) - x sqrt(9-x^2)/2", r: ["-2.8", "2.8"], p: R`x = 3\sin\theta \;\Rightarrow\; 9\int \sin^2\theta\,d\theta` },
    { id: "i078", t: "trigsust", d: 2, f: "1/sqrt(x^2+4)", F: "ln(x + sqrt(x^2+4))", r: ["-3", "3"], p: R`x = 2\tan\theta \;\Rightarrow\; \int \sec\theta\,d\theta` },
    { id: "i079", t: "trigsust", d: 2, f: "1/(x^2+9)^(3/2)", F: "x/(9 sqrt(x^2+9))", r: ["-3", "3"], p: R`x = 3\tan\theta \;\Rightarrow\; \frac19\int \cos\theta\,d\theta` },
    { id: "i080", t: "trigsust", d: 3, f: "sqrt(x^2-1)/x", F: "sqrt(x^2-1) - arctan(sqrt(x^2-1))", r: ["1.2", "5"], p: R`x = \sec\theta \;\Rightarrow\; \int \tan^2\theta\,d\theta` },
    { id: "i081", t: "trigsust", d: 2, f: "1/(x^2 sqrt(x^2+1))", F: "-sqrt(x^2+1)/x", r: ["0.3", "4"], p: R`x = \tan\theta \;\Rightarrow\; \int \frac{\cos\theta}{\sin^2\theta}\,d\theta` },
    { id: "i082", t: "trigsust", d: 3, f: "x^3/sqrt(1-x^2)", F: "-(x^2+2) sqrt(1-x^2)/3", r: ["-0.9", "0.9"], p: R`x = \sin\theta \;\Rightarrow\; \int \sin^3\theta\,d\theta` },
    { id: "i083", t: "trigsust", d: 2, f: "1/(1-x^2)^(3/2)", F: "x/sqrt(1-x^2)", r: ["-0.9", "0.9"], p: R`x = \sin\theta \;\Rightarrow\; \int \sec^2\theta\,d\theta` },
    { id: "i084", t: "trigsust", d: 2, def: true, f: "sqrt(4-x^2)", F: "x sqrt(4-x^2)/2 + 2arcsin(x/2)", r: ["0", "2"], v: "pi", p: R`x = 2\sin\theta,\; \theta \in [0, \tfrac{\pi}{2}] \;\Rightarrow\; 4\int \cos^2\theta\,d\theta` },
    { id: "i085", t: "trigsust", d: 3, f: "x^2 sqrt(1-x^2)", F: "(arcsin(x) - x sqrt(1-x^2) (1-2x^2))/8", r: ["-0.9", "0.9"], p: R`x = \sin\theta \;\Rightarrow\; \int \sin^2\theta\cos^2\theta\,d\theta = \frac18\int (1 - \cos 4\theta)\,d\theta` },
    { id: "i086", t: "trigsust", d: 3, f: "1/(x sqrt(x^2+4))", F: "-ln((2+sqrt(x^2+4))/x)/2", r: ["0.3", "5"], p: R`x = 2\tan\theta \;\Rightarrow\; \frac12\int \csc\theta\,d\theta` },

    /* ---------- identidades trigonométricas ---------- */
    { id: "i087", t: "trig", d: 1, f: "sin(x)^3", F: "-cos(x) + cos(x)^3/3", r: ["-3", "3"], p: R`\sin^3 x = (1 - \cos^2 x)\sin x,\quad u = \cos x` },
    { id: "i088", t: "trig", d: 1, f: "cos(x)^2", F: "x/2 + sin(2x)/4", r: ["-3", "3"], p: R`\cos^2 x = \frac{1 + \cos 2x}{2}` },
    { id: "i089", t: "trig", d: 2, f: "sin(x)^2 cos(x)^3", F: "sin(x)^3/3 - sin(x)^5/5", r: ["-3", "3"], p: R`\cos^3 x = (1 - \sin^2 x)\cos x,\quad u = \sin x` },
    { id: "i090", t: "trig", d: 2, f: "tan(x)^3", F: "tan(x)^2/2 + ln(cos(x))", r: ["-1.2", "1.2"], p: R`\tan^3 x = \tan x\,(\sec^2 x - 1)` },
    { id: "i091", t: "trig", d: 3, f: "sec(x)^3", F: "(sec(x) tan(x) + ln(sec(x) + tan(x)))/2", r: ["-1.2", "1.2"], p: R`u = \sec x,\; dv = \sec^2 x\,dx \text{ y } \tan^2 x = \sec^2 x - 1` },
    { id: "i092", t: "trig", d: 2, f: "sin(3x) cos(x)", F: "-cos(4x)/8 - cos(2x)/4", r: ["-3", "3"], p: R`\sin 3x\cos x = \frac{\sin 4x + \sin 2x}{2}` },
    { id: "i093", t: "trig", d: 3, f: "sin(x)^4", F: "3x/8 - sin(2x)/4 + sin(4x)/32", r: ["-3", "3"], p: R`\sin^4 x = \left(\frac{1 - \cos 2x}{2}\right)^2` },
    { id: "i094", t: "trig", d: 2, f: "tan(x)^2 sec(x)^4", F: "tan(x)^3/3 + tan(x)^5/5", r: ["-1.2", "1.2"], p: R`\sec^4 x = (1 + \tan^2 x)\sec^2 x,\quad u = \tan x` },
    { id: "i095", t: "trig", d: 2, f: "1/(1+cos(x))", F: "tan(x/2)", r: ["-2.5", "2.5"], p: R`1 + \cos x = 2\cos^2\tfrac{x}{2}` },
    { id: "i096", t: "weier", d: 3, f: "1/(1+sin(x)+cos(x))", F: "ln(1+tan(x/2))", r: ["-1.4", "2.5"], p: R`t = \tan\tfrac{x}{2} \;\Rightarrow\; \int \frac{dt}{1+t}` },
    { id: "i097", t: "weier", d: 3, f: "1/(2+cos(x))", F: "2/sqrt(3) arctan(tan(x/2)/sqrt(3))", r: ["-2.5", "2.5"], p: R`t = \tan\tfrac{x}{2} \;\Rightarrow\; \int \frac{2\,dt}{t^2 + 3}` },
    { id: "i098", t: "trig", d: 2, f: "sec(x)", F: "ln(sec(x) + tan(x))", r: ["-1.2", "1.2"], p: R`\text{Multiplica por } \frac{\sec x + \tan x}{\sec x + \tan x}` },
    { id: "i099", t: "trig", d: 1, def: true, f: "sin(x)^2", F: "x/2 - sin(2x)/4", r: ["0", "pi"], v: "pi/2", p: R`\sin^2 x = \frac{1 - \cos 2x}{2}` },
    { id: "i100", t: "trig", d: 1, def: true, f: "cos(x)^3", F: "sin(x) - sin(x)^3/3", r: ["0", "pi/2"], v: "2/3", p: R`\cos^3 x = (1 - \sin^2 x)\cos x,\quad u = \sin x` },

    /* ---------- racionalizar ---------- */
    { id: "i101", t: "raiz", d: 2, f: "1/(1+sqrt(x))", F: "2sqrt(x) - 2ln(1+sqrt(x))", r: ["0.1", "9"], p: R`u = \sqrt{x},\; dx = 2u\,du \;\Rightarrow\; \int \frac{2u}{1+u}\,du` },
    { id: "i102", t: "raiz", d: 2, f: "sqrt(x)/(1+x)", F: "2sqrt(x) - 2arctan(sqrt(x))", r: ["0.1", "9"], p: R`u = \sqrt{x} \;\Rightarrow\; \int \frac{2u^2}{1+u^2}\,du` },
    { id: "i103", t: "raiz", d: 1, f: "x/sqrt(x+1)", F: "2/3 (x+1)^(3/2) - 2sqrt(x+1)", r: ["0", "5"], p: R`u = \sqrt{x+1},\; x = u^2 - 1 \;\Rightarrow\; 2\int (u^2 - 1)\,du` },
    { id: "i104", t: "raiz", d: 2, f: "1/(x sqrt(x-1))", F: "2arctan(sqrt(x-1))", r: ["1.2", "6"], p: R`u = \sqrt{x-1} \;\Rightarrow\; \int \frac{2\,du}{u^2+1}` },
    { id: "i105", t: "raiz", d: 3, f: "1/(sqrt(x) + x^(1/3))", F: "2sqrt(x) - 3x^(1/3) + 6x^(1/6) - 6ln(1+x^(1/6))", r: ["0.1", "9"], p: R`u = x^{1/6} \;\Rightarrow\; 6\int \frac{u^3}{u+1}\,du` },

    /* ---------- definidas ---------- */
    { id: "i106", t: "partes", d: 1, def: true, f: "x exp(x)", F: "(x-1) exp(x)", r: ["0", "1"], v: "1", p: R`u = x,\quad dv = e^x\,dx` },
    { id: "i107", t: "sust", d: 1, def: true, f: "x/(x^2+1)", F: "ln(x^2+1)/2", r: ["0", "1"], v: "ln(2)/2", p: R`u = x^2 + 1,\quad du = 2x\,dx` },
    { id: "i108", t: "sust", d: 2, def: true, f: "exp(x)/(1+exp(x))", F: "ln(1+exp(x))", r: ["0", "ln(2)"], v: "ln(3/2)", p: R`u = 1 + e^x:\; \int_2^3 \frac{du}{u}` },
    { id: "i109", t: "partes", d: 1, def: true, f: "x cos(x)", F: "x sin(x) + cos(x)", r: ["0", "pi/2"], v: "pi/2 - 1", p: R`u = x,\quad dv = \cos x\,dx` },
    { id: "i110", t: "trigsust", d: 2, def: true, f: "sqrt(1-x^2)", F: "(x sqrt(1-x^2) + arcsin(x))/2", r: ["0", "1"], v: "pi/4", p: R`x = \sin\theta \;\Rightarrow\; \int_0^{\pi/2} \cos^2\theta\,d\theta` },
    { id: "i111", t: "partes", d: 2, def: true, f: "x^2 exp(x)", F: "(x^2-2x+2) exp(x)", r: ["0", "1"], v: "e - 2", p: R`u = x^2,\; dv = e^x\,dx \text{ (dos veces)}` },
    { id: "i112", t: "sust", d: 1, def: true, f: "ln(x)/x", F: "ln(x)^2/2", r: ["1", "e"], v: "1/2", p: R`u = \ln x:\; \int_0^1 u\,du` },
    { id: "i113", t: "sust", d: 3, def: true, f: "x^3 sqrt(1-x^2)", F: "-(1-x^2)^(3/2)/3 + (1-x^2)^(5/2)/5", r: ["0", "1"], v: "2/15", p: R`u = 1 - x^2,\; x^2 = 1 - u:\; \frac12\int_0^1 (1-u)\sqrt{u}\,du` },
    { id: "i114", t: "fracc", d: 1, def: true, f: "1/(x (x+1))", F: "ln(x/(x+1))", r: ["1", "3"], v: "ln(3/2)", p: R`\frac{1}{x(x+1)} = \frac{1}{x} - \frac{1}{x+1}` },
    { id: "i115", t: "sust", d: 1, def: true, f: "sec(x)^2 tan(x)", F: "tan(x)^2/2", r: ["0", "pi/4"], v: "1/2", p: R`u = \tan x:\; \int_0^1 u\,du` },
    { id: "i116", t: "partes", d: 2, def: true, f: "x ln(x)", F: "x^2/2 ln(x) - x^2/4", r: ["1", "e"], v: "(e^2+1)/4", p: R`u = \ln x,\quad dv = x\,dx` },
    { id: "i117", t: "partes", d: 2, def: true, f: "arcsin(x)", F: "x arcsin(x) + sqrt(1-x^2)", r: ["0", "1"], v: "pi/2 - 1", p: R`u = \arcsin x,\quad dv = dx` },
    { id: "i118", t: "partes", d: 3, def: true, f: "exp(x) sin(x)", F: "exp(x) (sin(x) - cos(x))/2", r: ["0", "pi"], v: "(exp(pi)+1)/2", p: R`\text{Cíclica: dos veces por partes y despeja}` },
    { id: "i119", t: "cuad", d: 1, def: true, f: "1/(x^2+2x+2)", F: "arctan(x+1)", r: ["-1", "0"], v: "pi/4", p: R`x^2 + 2x + 2 = (x+1)^2 + 1` },
    { id: "i120", t: "fracc", d: 1, def: true, f: "x^2/(x^2+1)", F: "x - arctan(x)", r: ["0", "1"], v: "1 - pi/4", p: R`\frac{x^2}{x^2+1} = 1 - \frac{1}{x^2+1}` },
    { id: "i121", t: "trig", d: 2, def: true, f: "sin(x)^3", F: "-cos(x) + cos(x)^3/3", r: ["0", "pi"], v: "4/3", p: R`\sin^3 x = (1 - \cos^2 x)\sin x:\; \int_{-1}^{1} (1 - u^2)\,du` },
    { id: "i122", t: "raiz", d: 2, def: true, f: "1/(1+sqrt(x))", F: "2sqrt(x) - 2ln(1+sqrt(x))", r: ["0", "4"], v: "4 - 2ln(3)", p: R`u = \sqrt{x}:\; \int_0^2 \frac{2u}{1+u}\,du` },
    { id: "i123", t: "raiz", d: 2, def: true, f: "x/sqrt(1+x)", F: "2/3 (x+1)^(3/2) - 2sqrt(x+1)", r: ["0", "3"], v: "8/3", p: R`u = \sqrt{1+x}:\; 2\int_1^2 (u^2 - 1)\,du` }
  ];

  return { TECNICAS, BANCO };
});
