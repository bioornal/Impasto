# Prompts de imagen — Carta Impasto

Plantilla para generar las fotos de las tarjetas de producto del e-commerce.
La idea es que las 20 pizzas parezcan sacadas de la misma sesión de fotos: mismo
ángulo, misma tabla, misma luz, mismo encuadre. Por eso el **bloque fijo no se
toca nunca** — lo único que cambia es el bloque variable.

---

## 1. Plantilla maestra

Copiá esto entero y reemplazá solo lo que está entre corchetes.

```
Fotografía gastronómica ultrarrealista, calidad editorial para carta digital.

TOMA: cenital exacta, 90° desde arriba. Una sola pizza individual centrada,
llenando el encuadre: el cornicione toca los bordes izquierdo y derecho y se sale
apenas de cuadro por arriba y por abajo. Casi no se ve fondo — solo asoma en las
cuatro esquinas. Formato horizontal 4:3.

PIZZA: napolitana auténtica de horno de leña, tamaño individual de unos 26 cm,
base fina en el centro.

CORTE: la masa está entera, no separada en porciones. Lo único que la atraviesa
son 2 finas marcas de cuchillo: una va de las 12 a las 6 en punto, la otra va de
las 9 a las 3 en punto. Se cruzan en el centro formando una cruz. No hay marcas
en las diagonales: nada a las 1:30, nada a las 4:30, nada a las 7:30, nada a las
10:30. En toda la imagen se ven 2 líneas, ni una más.

CORNICIONE: alto e inflado, pero desparejo — nunca un anillo perfecto. La altura
varía a lo largo del borde: dos o tres burbujas grandes e infladas en zonas
distintas, y tramos más bajos y achatados entre ellas. Leopardado asimétrico,
con manchas oscuras agrupadas en un sector del borde y casi ausentes en el
opuesto. El contorno de la pizza es levemente irregular, hecho a mano: no un
círculo trazado con compás.

VARIACIÓN DEL BORDE: la burbuja más grande e inflada del cornicione está a las
[HORA A] en punto, y el sector más tostado del borde está a las [HORA B] en
punto. (Cambiá estas dos horas en cada pizza: es lo que evita que las 20 fotos
terminen con el mismo borde clonado.)

IMPERFECCIONES CONTROLADAS: el cruce de las dos marcas de corte apenas corrido
del centro exacto. Alguna burbuja de queso reventada. Un punto donde la salsa se
escapa y llega a tocar el cornicione. Restos mínimos de harina cruda sin cocinar
en la base del borde. Tiene que leerse como una pizza real hecha a mano, no como
una réplica de catálogo.

TEXTURA Y REALISMO (crítico): la muzzarella NO es una capa lisa ni un brillo
parejo. Tiene zonas mate y zonas con brillo puntual, burbujas doradas de
distinto tamaño, bordes levemente resecos donde pegó más el calor, y pequeños
charcos de grasa separada. El cornicione es poroso y rústico: alveolos abiertos
de distinto tamaño, alguna grieta fina en la corteza, superficie con relieve
irregular, harina sin cocinar en algunos puntos. Nada de superficies uniformes,
barniz plástico, brillo de cera ni aspecto de cerámica esmaltada. Es una
fotografía real de cámara: grano fino visible, microcontraste natural, reflejos
especulares pequeños e irregulares. No es un render 3D ni una ilustración
hiperrealista.

BASE: [BASE]
EN EL HORNO: [INGREDIENTES QUE VAN ANTES DE HORNEAR]
AL SALIR DEL HORNO: [TERMINACIONES EN FRÍO O TIBIAS]
DETALLE: [textura o gesto distintivo de este sabor]

FONDO: superficie mate oscura y cálida — pizarra carbón o cemento quemado en
tono grafito cálido, casi negro en las esquinas del cuadro. Se ve muy poco, pero
lo que asoma tiene que contrastar fuerte con el dorado de la corteza. El mismo
fondo en las 20 fotos. Sin tablas de madera, sin mantel, sin utensilios, sin
ingredientes sueltos alrededor, sin props de ningún tipo.

LUZ: luz dirigida desde arriba a la izquierda, tipo ventana lateral alta, que
genera relieve: brillos especulares nítidos y chicos sobre el queso fundido,
sombras suaves pero definidas en los huecos del cornicione y debajo de los
toppings. Contraste medio-alto. Un hilo de vapor apenas visible.

COLOR: paleta cálida y apetitosa, con saturación generosa pero natural. Dorados
intensos en la corteza, rojo vivo en el tomate, blanco cremoso en el queso,
negros con densidad en el leopardado y en el fondo. Imagen con cuerpo, como foto
de revista de cocina — nunca lavada, gris, plana ni de bajo contraste.

PRUEBA DE MINIATURA: la foto se va a ver dentro de una tarjeta de unos 300 px de
ancho. A ese tamaño tiene que seguir leyéndose apetitosa y reconocerse de qué
sabor es. Si a 300 px se ve pálida o vacía, está mal resuelta.

CÁMARA: 50 mm, f/5.6, nitidez pareja en toda la pizza. Máximo detalle en la
textura de los toppings: burbujas del queso fundido, brillo del aceite, nervadura
de las hojas frescas, grano de los frutos secos, fibras de la carne.

COMPOSICIÓN: la pizza domina todo el cuadro, sin aire muerto alrededor. Dejar la
esquina inferior derecha sin ningún topping protagonista: ahí va el precio.

NO INCLUIR: fondo claro, gris pálido o lavado; imagen plana, apagada o de bajo
contraste; espacio vacío alrededor de la pizza; pizza chica y lejana dentro del
cuadro. Tampoco marcas de corte en las diagonales; pizza cortada en 6, 8, 10 o 12
porciones; cortes radiales tipo rueda; más de 2 líneas en la superficie; porciones
separadas o corridas de su lugar. Ni texto, letras, números,
logos, marcas, manos, personas, cubiertos, botellas, latas, servilletas, platos
estampados, ingredientes que no estén en la lista, quemaduras excesivas, aspecto
de plástico o de render 3D.
```

### Por qué cada cosa

- **Cenital y cortada en 4** — es lo que mejor muestra los toppings y lo que más
  fácil se repite igual en 20 fotos. Un ángulo de 45° queda lindo suelto, pero en
  una grilla de tarjetas se nota enseguida cuando cada foto está tomada distinto.
- **Esquina inferior derecha libre** — ahí va el precio en la tarjeta. Si el
  generador pone un topping llamativo justo ahí, el badge lo tapa.
- **Fondo oscuro y crop a sangre** — es lo que hace que la foto salte dentro de
  una tarjeta chica. La tienda tiene fondo crema y tarjetas color hueso: una foto
  clara sobre fondo claro se funde con la página y se ve apagada, por más linda
  que sea en grande. Con fondo oscuro y la pizza llenando el cuadro, el thumbnail
  se recorta contra el crema y tira del ojo. Es lo mismo que hacen las grandes
  apps de pedidos: casi nunca vas a ver aire vacío alrededor del plato.
  Si algún día lo cambiás, cambialo en las 20 a la vez: el fondo mezclado es lo
  que hace ver amateur a una carta.
- **Luz lateral, no plana** — la luz difusa pareja aplana todo y es parte de por
  qué el queso se veía de plástico. Una luz dirigida desde arriba a la izquierda
  crea sombras en los huecos del cornicione y brillos chicos sobre el queso: eso
  es lo que da volumen y hace que se vea comestible.
- **El bloque de imperfecciones no es decorativo** — es lo que separa una foto
  de comida real de una imagen de stock. Un cornicione parejo y un círculo
  perfecto delatan al instante que la foto es generada.

---

## 2. Cómo mantener la consistencia

1. Generá primero **una sola pizza** (la Muzzarella Impasto sirve bien de patrón)
   y repetí hasta que quede exactamente como la querés. Esa es tu foto madre.
2. Para las otras 19, adjuntá la foto madre como referencia — pero **aclarale qué
   copiar y qué no**, o te va a clonar también el borde y las 20 pizzas van a
   tener el cornicione idéntico, que es lo que más delata una carta generada:

   > *"Mantené de la imagen de referencia el fondo, la luz, el ángulo y el
   > encuadre. La pizza es OTRA: el cornicione tiene otra distribución de
   > burbujas y de manchas de horno, otro contorno y otra altura de borde. No
   > copies el borde de la referencia."*

   Reforzalo cambiando las dos horas del bloque VARIACIÓN DEL BORDE en cada
   pizza: le das una posición concreta distinta y deja de repetir el mismo
   patrón.
3. Mantené siempre el mismo formato 4:3 y generá a 1600x1200 o más: el sitio
   recorta, y de una imagen chica no se puede recuperar detalle.
4. Si una sale con el cornicione feo o el queso plástico, regenerá en vez de
   corregir con otro prompt: sale más rápido y más parejo.

---

## 2b. El problema de los cortes

Los generadores tienen grabadísimo que "pizza cortada" es igual a ocho porciones.
Ni el número ("4 porciones") ni la geometría ("dos cortes en cruz") le ganan
siempre a esa costumbre: lo típico es que dibujen la cruz **y además** las dos
diagonales, y terminen en ocho.

La versión del bloque CORTE que está arriba usa tres trucos juntos: evita la
palabra "porciones" (que es la que dispara el patrón), ubica cada línea por
posición de reloj, y nombra explícitamente las diagonales prohibidas. Con eso
acierta bastante más seguido.

### Recomendación: pizza entera

Para tarjetas de e-commerce, lo más sensato es **no cortarlas**. Las marcas
premium fotografían la pizza entera, y en una toma cenital sin nada al lado que
dé escala, el corte no comunica que sea individual: eso lo dice el texto de la
carta, no la foto. Te ahorrás pelear con esto en cada una de las 20 imágenes.

Si vas por ahí, reemplazá todo el bloque CORTE por:

```
CORTE: la pizza está entera, sin cortar. La superficie no tiene ninguna marca de
cuchillo ni línea de corte.
```

y en NO INCLUIR dejá: `porciones, cortes o líneas de corte de cualquier tipo`.

### Si igual las querés cortadas

1. **Dos pasos, no uno.** Generá primero la pizza entera, que siempre sale bien.
   Después, sobre esa imagen, pedí: *"editá esta imagen: agregá solamente dos
   marcas de cuchillo finas, una vertical de arriba abajo y otra horizontal de
   izquierda a derecha, cruzándose en el centro. No agregues ninguna otra marca.
   No cambies nada más de la imagen."* Agregar dos líneas a una pizza entera le
   sale mucho mejor que contener el impulso de hacer ocho.
2. **Editá, no regeneres.** Sobre la de ocho porciones: *"borrá las cuatro marcas
   diagonales, dejá solo la vertical y la horizontal. No cambies nada más."*
3. **Imagen de referencia.** Si ChatGPT ya te sacó una bien cortada, adjuntala en
   Gemini y pedí "mismo corte que la imagen de referencia".
4. **Repetí al final.** Última línea del prompt, después de NO INCLUIR:
   *"Importante: solo 2 líneas de corte, en cruz. Ninguna diagonal."* Lo último
   que lee pesa más que lo del medio.

---

## 3. Bloques variables — las 20 pizzas

Cada bloque reemplaza las cuatro líneas del medio de la plantilla.

### 1. Muzzarella Impasto
```
BASE: salsa de tomate italiano, extendida en espiral hasta el cornicione.
EN EL HORNO: muzzarella en trozos, fundida y burbujeante.
AL SALIR DEL HORNO: orégano seco espolvoreado, hilo fino de aceite de oliva.
DETALLE: la simpleza es el punto — queso recién fundido con burbujas doradas y
algún punto tostado, sin nada que lo tape.
```

### 2. Napoletana all'Aglio
```
BASE: pomodoro.
EN EL HORNO: muzzarella, rodajas finas de tomate fresco distribuidas.
AL SALIR DEL HORNO: dientes de ajo confitado enteros y dorados, unos pocos
puntos discretos de pesto verde, lascas finas de parmesano.
DETALLE: los dientes de ajo confitado, brillantes y translúcidos, apoyados
enteros sobre el queso; el pesto solo como acento de color, en gotas pequeñas y
espaciadas, nunca cubriendo la pizza.
```

### 3. Fugazzetta al Provolone
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella y provolone fundidos juntos, cebolla en aros abundante
y dorada cubriendo toda la superficie.
AL SALIR DEL HORNO: pimienta negra recién molida, hilo de aceite de oliva,
pimentón ahumado espolvoreado.
DETALLE: la montaña de cebolla dorada con los bordes apenas caramelizados, y el
provolone asomando fundido entre los aros.
```

### 4. Porteña de Jamón y Morrones
```
BASE: pomodoro.
EN EL HORNO: muzzarella, fetas de jamón cocido dobladas en ondas, tiras anchas
de morrón rojo asado.
AL SALIR DEL HORNO: aceite de provenzal brillante (ajo y perejil picados en
aceite) en hilos.
DETALLE: el contraste del rojo profundo del morrón asado contra el rosa del
jamón y el brillo verde del provenzal.
```

### 5. Quattro Formaggi e Noci
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, provolone, trozos de queso azul con vetas, parmesano
rallado.
AL SALIR DEL HORNO: hilo de miel de ajo brillante en zigzag, almendras tostadas
fileteadas.
DETALLE: las vetas azul verdosas del queso derritiéndose apenas, y la miel
haciendo un brillo ámbar sobre el queso pálido.
```

### 6. Palmitos y Salsa Golf
```
BASE: pomodoro.
EN EL HORNO: muzzarella, rodajas de palmito distribuidas.
AL SALIR DEL HORNO: líneas finas de salsa golf rosada en zigzag prolijo,
perejil picado fresco.
DETALLE: el zigzag limpio y parejo de la salsa golf, y el blanco marfil de los
palmitos asomando entre el queso.
```

### 7. Diavola al Miele Piccante
```
BASE: pomodoro.
EN EL HORNO: muzzarella, rodajas de salame calabrés que se curvan en cuenquitos
con el aceite rojo juntándose adentro.
AL SALIR DEL HORNO: hilo de miel picante brillante, unas gotas pequeñas de pesto
verde como acento.
DETALLE: los cuenquitos de salame con el aceite rojo brillante adentro y la miel
cayendo encima en un hilo continuo; el verde del pesto solo en puntos aislados,
para cortar el rojo.
```

### 8. Mortazza al Pistacchio
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella fundida.
AL SALIR DEL HORNO: fetas de mortadela dobladas en ondas altas y volumétricas,
cucharadas de ricota cremosa batida, hilos de pesto de albahaca, pistachos
picados espolvoreados.
DETALLE: el volumen de las ondas de mortadela con su grasa marmolada visible,
contra los montoncitos blancos de ricota y el verde intenso del pistacho.
```

### 9. Bondiola al Pangrattato
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella fundida.
AL SALIR DEL HORNO: láminas finas de bondiola, pangrattato dorado y crocante
espolvoreado generoso, cucharadas de ricota cremosa batida.
DETALLE: el pangrattato dorado con textura granulada visible sobre las láminas
de bondiola, y el contraste con los montoncitos blancos de ricota.
```

### 10. Pepperoni e Panceta
```
BASE: pomodoro.
EN EL HORNO: muzzarella, rodajas de pepperoni acopadas con los bordes
levantados, cubos de panceta dorada y crocante.
AL SALIR DEL HORNO: orégano fresco, escamas de ají seco rojo.
DETALLE: los bordes acopados y algo tostados del pepperoni, con el aceite
naranja brillante acumulado en el centro de cada rodaja.
```

### 11. Americana Agridulce
```
BASE: pomodoro.
EN EL HORNO: muzzarella, panceta en trozos dorados y crocantes.
AL SALIR DEL HORNO: hilos de salsa agridulce roja translúcida y brillante,
verdeo cortado en aros finos.
DETALLE: el brillo vidriado de la salsa agridulce contra el mate de la panceta,
y los aros verdes frescos de verdeo repartidos.
```

### 12. Patate e Rosmarino
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, provolone, rodajas finas de papa superpuestas como
escamas, doradas en los bordes por el horno.
AL SALIR DEL HORNO: ramitas de romero fresco, panceta crocante desmenuzada,
hilo de aceite de ajo.
DETALLE: las rodajas de papa superpuestas como escamas con los bordes dorados y
crocantes, y las agujas del romero nítidas encima.
```

### 13. Carbonara Impasto
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, cubos de panceta dorada, un huevo entero cocido en el
centro en un nido de queso, con la yema firme, entera y brillante.
AL SALIR DEL HORNO: parmesano rallado, pimienta negra gruesa recién molida.
DETALLE: el huevo entero centrado y perfecto, con la yema brillante y la clara
cuajada abrazada por el queso fundido alrededor.
```

### 14. Porro e Panceta Croccante
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, puerro salteado en aros translúcidos y sedosos.
AL SALIR DEL HORNO: panceta crocante en trozos irregulares, pimienta negra
molida.
DETALLE: la transparencia sedosa de los aros de puerro contra el marrón
crocante e irregular de la panceta.
```

### 15. Cinque Formaggi
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, provolone, queso azul en trozos, parmesano, puntos de
queso crema repartidos.
AL SALIR DEL HORNO: hilos oscuros de reducción de balsámico, almendras
tostadas, hojas de rúcula fresca.
DETALLE: la superficie de cinco quesos con texturas distintas conviviendo, y
los hilos oscuros del balsámico cruzando por encima.
```

### 16. La Provoleta Impasto
```
BASE: sin salsa, base blanca.
EN EL HORNO: provolone abundante, fundido y burbujeante, cubriendo toda la
superficie; orégano, ají molido y pimentón ahumado espolvoreados encima.
AL SALIR DEL HORNO: cucharadas de chimichurri verde, tomates cherry asados
partidos al medio.
DETALLE: la superficie de provoleta burbujeante y dorada, con el chimichurri
verde intenso y los cherries asados reventados encima.
```

### 17. Choclo, Panceta y Salsa Criolla
```
BASE: pomodoro.
EN EL HORNO: muzzarella, granos de choclo dorados, panceta en trozos.
AL SALIR DEL HORNO: salsa criolla en cucharadas (tomate, cebolla y morrón en
cubitos parejos), perejil picado.
DETALLE: los cubitos nítidos y coloridos de la salsa criolla encima, contra los
granos de choclo dorados del horno.
```

### 18. Filetto Impasto
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella, tiras de lomo salteado jugoso y rosado por dentro,
cebolla morada en juliana.
AL SALIR DEL HORNO: cheddar fundido en hilos gruesos, verdeo en aros finos.
DETALLE: los hilos de cheddar anaranjado cayendo sobre las tiras de lomo, con el
violeta de la cebolla morada asomando.
```

### 19. Prosciutto, Rucola e Parmigiano
```
BASE: pomodoro.
EN EL HORNO: muzzarella fundida.
AL SALIR DEL HORNO: fetas de jamón crudo dobladas en ondas altas, rúcula fresca
abundante, lascas grandes de reggianito, hilos de aceto reducido.
DETALLE: el volumen aireado del jamón crudo y la rúcula levantándose sobre la
pizza, con las lascas de queso duro apoyadas encima.
```

### 20. Carbonada Criolla
```
BASE: sin salsa, base blanca.
EN EL HORNO: muzzarella y provolone, carne braseada desmechada, cubos de zapallo
asado con los bordes caramelizados, granos de choclo.
AL SALIR DEL HORNO: tiras de durazno seco rehidratado, cebolla morada encurtida
rosada, nuez moscada espolvoreada.
DETALLE: la paleta cálida de naranjas y ocres del zapallo, el choclo y el
durazno, cortada por el rosa vivo de la cebolla encurtida.
```

---

## 3b. Imagen de fondo del hero

Otro problema y por lo tanto otro prompt. Acá la foto no vende un producto: es
atmósfera, y encima va el titular, el párrafo y los botones. Las reglas que
mandan son tres:

- **El lado izquierdo tiene que quedar oscuro y vacío.** Ahí va "Pizza híbrida:
  técnica napolitana, alma argentina". Si el generador centra la pizza, el texto
  queda ilegible y no hay overlay que lo salve.
- **Nada de cenital.** En el hero querés ver el alto del cornicione y el relieve.
  Un ángulo bajo, de 30-40°, es mucho más cinematográfico.
- **Clave baja.** Fondo espresso que cae casi a negro, y un solo golpe de luz
  cálida sobre la pizza. Es lo que hace que el crema y el dorado de tu tipografía
  salten por encima.

### Prompt del hero — Quattro Formaggi e Noci

```
Fotografía gastronómica cinematográfica, calidad de campaña publicitaria, para
usarse como imagen de fondo de la portada de una web.

FORMATO: horizontal panorámico 21:9. Resolución mínima 2400 x 1100 px.

COMPOSICIÓN (lo más importante): la pizza está en el TERCIO DERECHO del cuadro,
entrando desde el borde derecho y cortada por el marco — no se ve entera. Los dos
tercios izquierdos son fondo en penumbra, prácticamente vacíos, sin objetos ni
ingredientes sueltos: ese espacio está reservado para texto. La luz cae en
degradado natural desde la derecha, donde está el brillo máximo, hasta casi negro
en el borde izquierdo.

ÁNGULO: cámara baja, a unos 30-40° sobre la mesa, casi a la altura del plato. Se
ve el relieve y el espesor de la pizza, no aplastada desde arriba.

SUJETO: una pizza napolitana individual de cuatro quesos recién salida del horno
de leña. Superficie de muzzarella, provolone y parmesano fundidos y burbujeantes,
con trozos de queso azul de vetas azul verdosas derritiéndose apenas. Por encima,
un hilo de miel cayendo brillante y ámbar, atrapado en el aire a mitad de camino,
y almendras tostadas fileteadas repartidas. Hilos de vapor subiendo y
recortándose contra la luz.

CORNICIONE: de altura moderada. NO es un borde alto ni inflado, ni un aro parejo
de masa: sube poco y de manera despareja. En algunos tramos apenas se levanta y
queda casi al ras del relleno; en otros hay una burbuja más marcada. El contorno
de la pizza es irregular, más ovalado que redondo, con un lado más estirado que
el otro: está estirada a mano, no moldeada con un aro.

IMPERFECCIONES: nada está acomodado a propósito. Un sector del borde está más
pálido y otro más tostado, con el leopardado agrupado de un solo lado. El queso
no cubre parejo: llega más cerca del borde de un lado que del otro. Las almendras
caen desordenadas, algunas superpuestas, y una quedó sobre la mesa al lado de la
pizza, del lado derecho. Debe parecer una pizza real que alguien acaba de sacar
del horno, no una pieza de utilería.

LUZ: clave baja, cinematográfica. Una sola fuente cálida y dirigida desde arriba
a la derecha, que hace de contraluz: recorta el borde del cornicione con un filo
dorado, enciende el hilo de miel y vuelve visible el vapor. Sombras profundas y
densas hacia la izquierda. Sin luz de relleno del lado izquierdo.

FONDO: mesa de madera oscura casi negra y pared en penumbra, completamente
desenfocadas. Al fondo, muy lejos y muy fuera de foco, el resplandor naranja
tenue de la boca de un horno de leña, apenas insinuado como manchas de luz. Nada
reconocible ni nítido.

CÁMARA: 50 mm, f/8. TODA la pizza nítida de punta a punta: el borde más cercano
a la cámara y el más lejano están igual de enfocados, y se distingue la textura
en toda la superficie. El fondo sale desenfocado por la distancia, no por una
apertura abierta. Nada de foco selectivo sobre una parte del producto. Grano fino
de película.

COLOR: paleta cálida y oscura — marrón espresso, negros densos, dorados
intensos, ámbar de la miel. Nada de tonos fríos, azulados ni grises.

ESPACIO PARA TEXTO: el tercio izquierdo debe quedar lo bastante oscuro y liso
como para que encima se lea texto en color crema sin necesidad de agregar una
capa de sombra artificial.

NO INCLUIR: cornicione alto, inflado o parejo como un aro de masa; pizza
perfectamente redonda o simétrica; partes del producto fuera de foco. Tampoco
texto, letras, logos, marcas de agua, manos, personas, cubiertos, platos
decorados, ingredientes desparramados por el lado izquierdo, fondo claro, imagen
plana o de bajo contraste, aspecto de render 3D.
```

### Variante con hilo de queso

Si querés algo más dinámico, cambiá el bloque SUJETO por este. Es más impactante
pero más difícil de que salga bien: probá varias veces.

```
SUJETO: una porción de pizza de cuatro quesos siendo levantada desde el borde
derecho del cuadro, con un hilo largo de queso fundido que se estira y cuelga,
brillante y tenso. Debajo queda el resto de la pizza, desenfocada. Un hilo de
miel ámbar cae sobre la porción. Almendras tostadas fileteadas. Vapor subiendo
a contraluz.
```

### Detalles prácticos del hero

- Generá también una **versión vertical u 1:1** del mismo hero para el celular:
  en pantalla chica el recorte centra la imagen y el espacio para texto de la
  izquierda desaparece. En esa versión, la pizza va abajo y el espacio libre
  arriba.
- Probala **con el texto encima antes de darla por buena**. Una foto hermosa que
  se come el titular no sirve como fondo.
- Para el resto de los sabores sirve el mismo prompt: cambiá solo el bloque
  SUJETO por el de la pizza que quieras destacar.

---

## 3c. Imagen de la sección "Nosotros"

La sección se llama "Impasto significa masa. Y acá todo empieza ahí." y el texto
habla de 48 horas de fermentación en frío, estirado a mano y sin moldes. La foto
tiene que ser eso: **la materia prima**, no el producto terminado. Sin manos, sin
personas y sin pizza armada: un bodegón oscuro con la masa como protagonista y
los ingredientes crudos alrededor.

El hueco es cuadrado y el fondo de la sección es marrón espresso, así que la foto
va oscura y cálida para integrarse, no para recortarse.

### Prompt — Nosotros (bodegón de ingredientes)

```
Bodegón gastronómico ultrarrealista, oscuro y cálido, estilo pintura flamenca
moderna, para la sección "Nosotros" de la web de una pizzería artesanal.

FORMATO: cuadrado 1:1. Resolución mínima 1600 x 1600 px.

TOMA: cenital, 90° desde arriba, sobre una mesada de madera muy oscura y gastada.

PROTAGONISTA: dos bollos de masa cruda en fermentación, ligeramente descentrados,
hinchados y relajados, con la piel brillante y tensa y burbujas de aire visibles
por debajo. Espolvoreados de forma despareja con harina. Uno de los dos quedó un
poco más deformado que el otro.

ALREDEDOR, en composición suelta y natural, nunca alineada ni simétrica:
- harina esparcida sobre la madera, con huellas y un pequeño montoncito
- un bol chico de cerámica rústica con tomates pelados enteros, rojos y jugosos
- una bocha de muzzarella fresca partida al medio, con su suero alrededor
- un hilo de aceite de oliva verde dorado en un cuenco pequeño
- orégano seco desparramado en un costado
Todo crudo, sin cocinar. Algunos elementos entran cortados por el borde del cuadro.

LUZ: una sola fuente cálida y lateral desde la izquierda, en clave baja, como luz
de ventana en un día nublado. Sombras largas, profundas y suaves hacia la derecha.
El fondo de la madera cae a casi negro en las esquinas.

CÁMARA: 50 mm, f/8. Todo nítido, con detalle fino en la textura de la masa, la
harina y la superficie de la madera. Grano fino de película.

COLOR: cálido y oscuro — marrón espresso, negros densos, y como puntos claros el
blanco cremoso de la masa y la muzzarella, el rojo profundo del tomate y el verde
dorado del aceite. Nada de tonos fríos ni azulados.

NO INCLUIR: pizza armada, cruda o cocida; ninguna preparación terminada; manos,
personas, brazos, ropa; hornos, fuego, llamas, resplandor naranja; pan, panes,
hogazas, espigas de trigo, granos ni semillas; texto, letras, logos; utensilios
modernos, electrodomésticos; fondo claro; composición simétrica o de catálogo;
aspecto de render 3D.
```

### Variante minimalista

Si el bodegón sale recargado, esta versión es más limpia y silenciosa. Cambiá el
bloque PROTAGONISTA y borrá el de ALREDEDOR:

```
PROTAGONISTA: un único disco de masa cruda recién estirada a mano, apoyado sobre
la madera oscura enharinada. El borde es más grueso y desparejo, el centro más
fino y translúcido. Se ven las marcas de los dedos y burbujas de aire atrapadas
bajo la superficie. Alrededor, solo harina esparcida sobre la madera. Nada más
en el cuadro.
```

### Variante de fermentación

También cuenta las 48 horas, y es la que más fácil sale bien:

```
PROTAGONISTA: seis o siete bollos de masa cruda en fermentación dentro de una caja
de madera clara, hinchados, brillantes y casi tocándose entre ellos, espolvoreados
de forma despareja con harina. Se ven las burbujas de la fermentación bajo la piel
de la masa. Uno quedó apenas deformado y distinto de los demás.
```

---

## 4. Ejemplo armado

Así queda un prompt completo, listo para pegar (Diavola al Miele Piccante):

```
Fotografía gastronómica ultrarrealista, calidad editorial para carta digital.

TOMA: cenital exacta, 90° desde arriba. Una sola pizza individual centrada,
llenando el encuadre: el cornicione toca los bordes izquierdo y derecho y se sale
apenas de cuadro por arriba y por abajo. Casi no se ve fondo — solo asoma en las
cuatro esquinas. Formato horizontal 4:3.

PIZZA: napolitana auténtica de horno de leña, tamaño individual de unos 26 cm,
base fina en el centro.

CORTE: la masa está entera, no separada en porciones. Lo único que la atraviesa
son 2 finas marcas de cuchillo: una va de las 12 a las 6 en punto, la otra va de
las 9 a las 3 en punto. Se cruzan en el centro formando una cruz. No hay marcas
en las diagonales: nada a las 1:30, nada a las 4:30, nada a las 7:30, nada a las
10:30. En toda la imagen se ven 2 líneas, ni una más.

CORNICIONE: alto e inflado, pero desparejo — nunca un anillo perfecto. La altura
varía a lo largo del borde: dos o tres burbujas grandes e infladas en zonas
distintas, y tramos más bajos y achatados entre ellas. Leopardado asimétrico,
con manchas oscuras agrupadas en un sector del borde y casi ausentes en el
opuesto. El contorno de la pizza es levemente irregular, hecho a mano: no un
círculo trazado con compás.

VARIACIÓN DEL BORDE: la burbuja más grande e inflada del cornicione está a las
[HORA A] en punto, y el sector más tostado del borde está a las [HORA B] en
punto. (Cambiá estas dos horas en cada pizza: es lo que evita que las 20 fotos
terminen con el mismo borde clonado.)

IMPERFECCIONES CONTROLADAS: el cruce de las dos marcas de corte apenas corrido
del centro exacto. Alguna burbuja de queso reventada. Un punto donde la salsa se
escapa y llega a tocar el cornicione. Restos mínimos de harina cruda sin cocinar
en la base del borde. Tiene que leerse como una pizza real hecha a mano, no como
una réplica de catálogo.

TEXTURA Y REALISMO (crítico): la muzzarella NO es una capa lisa ni un brillo
parejo. Tiene zonas mate y zonas con brillo puntual, burbujas doradas de
distinto tamaño, bordes levemente resecos donde pegó más el calor, y pequeños
charcos de grasa separada. El cornicione es poroso y rústico: alveolos abiertos
de distinto tamaño, alguna grieta fina en la corteza, superficie con relieve
irregular, harina sin cocinar en algunos puntos. Nada de superficies uniformes,
barniz plástico, brillo de cera ni aspecto de cerámica esmaltada. Es una
fotografía real de cámara: grano fino visible, microcontraste natural, reflejos
especulares pequeños e irregulares. No es un render 3D ni una ilustración
hiperrealista.

BASE: pomodoro.
EN EL HORNO: muzzarella, rodajas de salame calabrés que se curvan en cuenquitos
con el aceite rojo juntándose adentro.
AL SALIR DEL HORNO: hilo de miel picante brillante, unas gotas pequeñas de pesto
verde como acento.
DETALLE: los cuenquitos de salame con el aceite rojo brillante adentro y la miel
cayendo encima en un hilo continuo; el verde del pesto solo en puntos aislados,
para cortar el rojo.

FONDO: superficie mate oscura y cálida — pizarra carbón o cemento quemado en
tono grafito cálido, casi negro en las esquinas del cuadro. Se ve muy poco, pero
lo que asoma tiene que contrastar fuerte con el dorado de la corteza. El mismo
fondo en las 20 fotos. Sin tablas de madera, sin mantel, sin utensilios, sin
ingredientes sueltos alrededor, sin props de ningún tipo.

LUZ: luz dirigida desde arriba a la izquierda, tipo ventana lateral alta, que
genera relieve: brillos especulares nítidos y chicos sobre el queso fundido,
sombras suaves pero definidas en los huecos del cornicione y debajo de los
toppings. Contraste medio-alto. Un hilo de vapor apenas visible.

COLOR: paleta cálida y apetitosa, con saturación generosa pero natural. Dorados
intensos en la corteza, rojo vivo en el tomate, blanco cremoso en el queso,
negros con densidad en el leopardado y en el fondo. Imagen con cuerpo, como foto
de revista de cocina — nunca lavada, gris, plana ni de bajo contraste.

PRUEBA DE MINIATURA: la foto se va a ver dentro de una tarjeta de unos 300 px de
ancho. A ese tamaño tiene que seguir leyéndose apetitosa y reconocerse de qué
sabor es. Si a 300 px se ve pálida o vacía, está mal resuelta.

CÁMARA: 50 mm, f/5.6, nitidez pareja en toda la pizza. Máximo detalle en la
textura de los toppings: burbujas del queso fundido, brillo del aceite, nervadura
de las hojas frescas, grano de los frutos secos, fibras de la carne.

COMPOSICIÓN: la pizza domina todo el cuadro, sin aire muerto alrededor. Dejar la
esquina inferior derecha sin ningún topping protagonista: ahí va el precio.

NO INCLUIR: fondo claro, gris pálido o lavado; imagen plana, apagada o de bajo
contraste; espacio vacío alrededor de la pizza; pizza chica y lejana dentro del
cuadro. Tampoco marcas de corte en las diagonales; pizza cortada en 6, 8, 10 o 12
porciones; cortes radiales tipo rueda; más de 2 líneas en la superficie; porciones
separadas o corridas de su lugar. Ni texto, letras, números,
logos, marcas, manos, personas, cubiertos, botellas, latas, servilletas, platos
estampados, ingredientes que no estén en la lista, quemaduras excesivas, aspecto
de plástico o de render 3D.
```

---

## 5. Empanadas — plantilla y sabores

Mismo sistema visual que las pizzas: mismo fondo oscuro, misma luz lateral, mismo
4:3, mismo crop apretado. Así las dos secciones de la carta se ven como una sola
sesión de fotos.

Lo que cambia es un problema que las pizzas no tienen: **el relleno no se ve**.
Una empanada cerrada es un bulto dorado idéntico al de al lado. Por eso:

- Las **canastitas** van enteras: la abertura de arriba muestra el relleno.
- Las **cerradas** (repulgue tradicional, pinzado y fatay) van con dos enteras y
  una tercera partida al medio, con el corte hacia arriba. Sin eso, en una
  miniatura de 300 px nadie distingue la de carne de la de pollo.

Van de a **tres unidades** por foto: una sola empanada en un 4:3 deja demasiado
aire y se ve chica y perdida.

### Una decisión a tomar: el ángulo

La plantilla usa cenital 90°, igual que las pizzas. Para las cerradas funciona
bien: desde arriba se ve el repulgue perfectamente. Pero en las **canastitas** el
cenital aplasta justo lo que las identifica — los pliegues verticales de la pared
quedan escondidos y solo se ve la boca con el relleno.

Si querés que se luzcan los pliegues, cambiá el bloque TOMA por este **en las
nueve empanadas**, no solo en las canastitas: lo importante es que las nueve
estén tomadas igual entre sí. Las pizzas quedan en cenital y no pasa nada, son
otra sección de la carta.

```
TOMA: casi cenital, cámara inclinada unos 20° respecto de la vertical. Se ve la
boca de las empanadas y el relleno desde arriba, pero también la altura y los
pliegues de la pared lateral. Formato horizontal 4:3.
```

### Plantilla maestra — empanadas

```
Fotografía gastronómica ultrarrealista, calidad editorial para carta digital.

TOMA: cenital exacta, 90° desde arriba. Formato horizontal 4:3.

COMPOSICIÓN: TRES empanadas llenando el encuadre, agrupadas de forma suelta y
natural, apenas superpuestas entre sí, nunca alineadas ni en fila. Ocupan casi
todo el cuadro y el fondo solo asoma en las esquinas.

MASA: masa casera de empanada al horno, dorada de forma despareja — más tostada
en los pliegues y en las partes altas, más pálida en el resto. Superficie
levemente ampollada y con brillo de pincelado de huevo, alguna burbuja y restos
mínimos de harina. Bordes hechos a mano, no troquelados: ninguna de las tres es
idéntica a las otras.

FORMA: [FORMA]
RELLENO: [RELLENO]
CÓMO SE MUESTRA: [APERTURA]

FONDO: superficie mate oscura y cálida — pizarra carbón o cemento quemado en tono
grafito, casi negro en las esquinas. El mismo fondo en todas las fotos de la
carta. Sin tablas de madera, sin mantel, sin utensilios, sin props.

LUZ: dirigida desde arriba a la izquierda, tipo ventana lateral alta. Marca el
relieve de los pliegues y deja sombras cortas y definidas entre las empanadas.
Contraste medio-alto.

COLOR: cálido y apetitoso, con saturación generosa pero natural. Dorados intensos
en la masa, negros con densidad en el fondo. Nunca lavado, gris ni plano.

CÁMARA: 50 mm, f/8. Nitidez pareja en las tres unidades, con detalle fino en la
textura de la masa y del relleno.

PRUEBA DE MINIATURA: la foto se va a ver en una tarjeta de unos 300 px de ancho.
A ese tamaño tiene que reconocerse el sabor. Si a 300 px parecen tres empanadas
iguales a cualquier otra, está mal resuelta.

COMPOSICIÓN DEL PRECIO: dejar la esquina inferior derecha sin detalle importante.

NO INCLUIR: fondo claro o lavado; imagen plana o de bajo contraste; aire vacío
alrededor; empanadas idénticas entre sí o alineadas como en catálogo; masa de tapa
industrial perfectamente circular y lisa; texto, letras, logos, manos, personas,
cubiertos, platos estampados; ingredientes que no estén en la lista; aspecto de
plástico o de render 3D.
```

### Prompt dedicado — canastitas (con imágenes de referencia)

Para los cinco sabores en canastita, este prompt reemplaza a la plantilla de
arriba: va completo y autocontenido, para pegar junto con las fotos de
referencia. Solo se cambia el bloque RELLENO.

Va con la cámara inclinada a propósito: la pared oblicua es lo que define a la
canastita, y en cenital no se ve por más que se la describas.

```
Fotografía gastronómica ultrarrealista, calidad editorial para carta digital.

IMAGEN DE REFERENCIA: usá las imágenes adjuntas ÚNICAMENTE para la FORMA de la
empanada: la altura de la pared, su inclinación hacia afuera y el dibujo de los
pliegues. El fondo, la luz, el encuadre, la cantidad de unidades y el color salen
de este prompt, no de las referencias. No copies la superficie, la vajilla ni la
iluminación de las fotos de referencia.

TOMA: casi cenital, con la cámara inclinada unos 25° respecto de la vertical. Se
ve el relleno desde arriba y, al mismo tiempo, la altura y los pliegues de la
pared lateral. Formato horizontal 4:3.

COMPOSICIÓN: TRES canastitas llenando el encuadre, agrupadas de forma suelta y
natural, apenas superpuestas, nunca alineadas ni en fila. Ocupan casi todo el
cuadro y el fondo solo asoma en las esquinas.

FORMA: canastita de PAREDES ALTAS Y OBLICUAS. La base es chica y plana; desde ahí
las paredes de masa suben abriéndose hacia afuera, como un tronco de cono
invertido o un vasito de papel de muffin. La pared es más alta que el radio de la
base: la empanada es claramente más alta que chata, se sostiene parada sola.

PLIEGUES: la pared está formada por masa recogida en pliegues verticales
sucesivos, como tela fruncida o como una bolsa de papel que se junta. Los
pliegues nacen cerca de la base, suben por toda la pared separándose entre sí a
medida que se abren, y terminan arriba en un borde ondulado de crestas y valles
irregulares. Entre seis y diez pliegues por canastita, ninguno igual al otro y
ninguna de las tres canastitas con el mismo dibujo.

BOCA: bien abierta arriba, ocupando casi todo el diámetro superior, con el
relleno a la vista al ras del borde o apenas sobresaliendo.

RELLENO: [RELLENO]

MASA: pálida y mate en las paredes, dorada solo en las crestas de los pliegues y
en el borde superior, que es donde pegó el horno. Superficie levemente ampollada
con brillo de pincelado de huevo. Hecha a mano, con el borde irregular.

FONDO: superficie mate oscura y cálida — pizarra carbón o cemento quemado en tono
grafito, casi negro en las esquinas. Sin tablas de madera, sin mantel, sin
rejillas, sin platos, sin utensilios, sin props.

LUZ: dirigida desde arriba a la izquierda, tipo ventana lateral alta. Marca el
relieve de los pliegues con sombras finas entre uno y otro, y deja sombras cortas
y definidas entre las canastitas. Contraste medio-alto.

COLOR: cálido y apetitoso, con saturación generosa pero natural. Dorados en las
crestas, negros con densidad en el fondo. Nunca lavado, gris ni plano.

CÁMARA: 50 mm, f/8. Nitidez pareja en las tres unidades, con detalle fino en la
textura de la masa, en los pliegues y en el relleno gratinado.

COMPOSICIÓN DEL PRECIO: dejar la esquina inferior derecha sin detalle importante.

NO INCLUIR: paredes rectas o verticales; canastita chata o baja; tartaleta de
borde liso; molde de muffin o papel; empanada cerrada, media luna o repulgue
trenzado; pliegues parejos y simétricos; las tres canastitas idénticas entre sí;
fondo claro o lavado; imagen plana o de bajo contraste; texto, letras, logos,
manos, personas, cubiertos, platos estampados, rejillas de horno; ingredientes
que no estén en la lista; aspecto de plástico o de render 3D.
```

Los cinco rellenos, para el bloque RELLENO:

```
Espinaca y muzzarella: espinaca salteada bien verde ligada con salsa blanca,
cubierta de muzzarella gratinada con manchas doradas.

Jamón y muzzarella: cubos de jamón cocido rosado entre muzzarella fundida y
gratinada, con hilos de queso y burbujas doradas en la superficie.

Roquefort: muzzarella fundida con trozos de queso azul de vetas azul verdosas
apenas derretidos, y alguna mancha dorada del gratinado. Las vetas azules tienen
que distinguirse con claridad: es lo único que identifica el sabor.

Palmito: rodajas de palmito blanco marfil entre muzzarella fundida y un ligado
cremoso rosado de salsa golf, gratinado en la superficie. Al menos una rodaja
tiene que quedar bien visible y reconocible.

Caprese: tomate en cubos que perdió agua y brilla, muzzarella fundida y gratinada
en los bordes, y unas gotas de pesto verde como acento.
```

---

### Los cuatro formatos de cierre

Están escritos completos dentro de cada sabor, pero conviene tenerlos a mano:

- **Canastita** — espinaca y muzza, jamón y muzza, roquefort, palmito, caprese
- **Repulgue tradicional** — carne, carne dulce
- **Repulgue pinzado** — pollo
- **Fatay triangular** — árabe

---

### 1. Carne
```
FORMA: media luna con repulgue tradicional argentino. El borde curvo está doblado
sobre sí mismo en pliegues sucesivos que se montan uno sobre otro, formando una
trenza gruesa y despareja de unos doce pliegues. Cerrada por completo.
RELLENO: carne cortada a cuchillo, jugosa, con cebolla, un trozo de huevo duro y
una aceituna verde entera. Condimentada con pimentón y comino, de modo que el
jugo tiñe la masa de anaranjado en el corte.
CÓMO SE MUESTRA: dos enteras y una tercera partida al medio, con las dos mitades
apoyadas con el corte hacia arriba en primer plano, mostrando el relleno jugoso.
```

### 2. Carne dulce
```
FORMA: media luna con repulgue tradicional argentino. El borde curvo está doblado
sobre sí mismo en pliegues sucesivos que se montan uno sobre otro, formando una
trenza gruesa y despareja de unos doce pliegues. Cerrada por completo.
RELLENO: carne cortada a cuchillo con cebolla, pasas de uva hinchadas y aceituna
verde. El relleno se ve más oscuro y más brillante que el de la carne salada, con
las pasas claramente visibles repartidas entre la carne.
CÓMO SE MUESTRA: dos enteras y una tercera partida al medio, con las dos mitades
apoyadas con el corte hacia arriba en primer plano. Las pasas tienen que quedar
bien a la vista: son lo único que la distingue de la de carne.
```

### 3. Pollo
```
FORMA: media luna cerrada con el borde sellado a presión y marcado con pinza,
dejando un dibujo de muescas regulares a lo largo del borde curvo. No tiene la
trenza doblada del repulgue tradicional. Cerrada por completo.
RELLENO: pollo desmenuzado en hilachas, con cebolla y morrón rojo en cubitos y un
ligado cremoso claro que lo envuelve.
CÓMO SE MUESTRA: dos enteras y una tercera partida al medio, con las dos mitades
apoyadas con el corte hacia arriba en primer plano, mostrando las hilachas de
pollo y el rojo del morrón.
```

### 4. Árabe

Esta va con **imágenes de referencia adjuntas** y con un bloque extra de
negativos. Es la forma que más se le escapa al generador: la resuelve como
estrella, como flor o como sobre de cuatro puntas, casi nunca como triángulo.

El punto fino es cuánto abre. No es una sfiha plana con el relleno expuesto a lo
ancho: es un fatay **medianamente abierto**, donde los pliegues de masa ocupan
más superficie que la ventana del centro. Por eso el prompt da la proporción en
números — es lo único que el generador respeta.

```
IMAGEN DE REFERENCIA: usá las imágenes adjuntas ÚNICAMENTE para copiar la forma y
el armado de la empanada: la geometría del triángulo, el grosor y el volumen de
los tres pliegues, y el tamaño de la abertura del centro. Todo lo demás —fondo,
luz, encuadre, cantidad de unidades, color— sale de este prompt y no de las
referencias.

FORMA: empanada árabe al horno, estilo fatay. Se arma sobre un disco de masa al
que se le levantan EXACTAMENTE TRES lados hacia el centro. Cada lado queda como
un pliegue grueso, inflado y redondeado, y los tres se unen de a dos en las tres
esquinas, que terminan en punta marcada y apenas curvada hacia arriba. Vista
desde arriba es un TRIÁNGULO de tres puntas: nunca cuatro, cinco ni más.

APERTURA (clave): los tres pliegues NO llegan a tocarse en el centro, pero
tampoco quedan abiertos de par en par. Dejan una ventana central de contorno
triangular redondeado que ocupa aproximadamente UN TERCIO de la superficie de la
empanada; los pliegues de masa ocupan los otros dos tercios. Está medianamente
abierta: ni sfiha plana con el relleno expuesto a lo ancho, ni empanada cerrada.

RELLENO: carne picada fina y jugosa con cebolla y cubitos de tomate, que asoma
únicamente por la ventana central y queda hundido, por debajo del nivel de los
pliegues. Brilla por el jugo, que oscurece la masa justo en el borde que toca.

MASA: dorada y brillante por el pincelado de huevo, con las partes altas de los
pliegues más tostadas, alguna ampolla y zonas más pálidas en los huecos. Los
pliegues tienen volumen real, inflados por el horno, no son solapas chatas.

CÓMO SE MUESTRA: las tres enteras, ninguna partida — el relleno ya se ve por la
ventana del centro. Un gajo de limón chico apoyado a un costado, como única
excepción a la regla de no usar props: es lo que identifica a la árabe de un
vistazo.

NO INCLUIR (además de lo anterior): empanadas de cuatro, cinco o seis puntas;
forma de estrella, de flor o de sobre; sfiha plana y completamente abierta con el
relleno a la vista en toda la superficie; centro cerrado, tapado o cosido;
pliegues chatos sin volumen; media luna con repulgue; empanada partida al medio.
```

### 5. Espinaca y muzzarella
```
FORMA: canastita. Base chica y redonda de la que suben paredes de masa, con una
altura parecida al ancho de la base, formando una cazuelita. Las paredes se arman
recogiendo la masa en PLIEGUES VERTICALES sucesivos, como tela fruncida: se
marcan de abajo hacia arriba y dejan el borde superior ondulado e irregular,
nunca liso ni parejo. La boca queda bien abierta, mostrando todo el relleno desde
arriba. No es una media luna, no tiene repulgue trenzado, no se cierra en el
centro y no es una tartaleta de borde liso.
MASA (canastita): pálida y mate en las paredes, dorada solo en las crestas de los
pliegues y en el borde superior, que es donde pegó el horno. Plegada a mano:
ninguna de las tres tiene la misma cantidad ni la misma forma de pliegues.
RELLENO: espinaca salteada bien verde ligada con salsa blanca, cubierta de
muzzarella gratinada con manchas doradas en la abertura.
CÓMO SE MUESTRA: las tres enteras, con el relleno visible y burbujeante en la
abertura superior. El verde de la espinaca tiene que verse desde arriba.
```

### 6. Jamón y muzzarella
```
FORMA: canastita. Base chica y redonda de la que suben paredes de masa, con una
altura parecida al ancho de la base, formando una cazuelita. Las paredes se arman
recogiendo la masa en PLIEGUES VERTICALES sucesivos, como tela fruncida: se
marcan de abajo hacia arriba y dejan el borde superior ondulado e irregular,
nunca liso ni parejo. La boca queda bien abierta, mostrando todo el relleno desde
arriba. No es una media luna, no tiene repulgue trenzado, no se cierra en el
centro y no es una tartaleta de borde liso.
MASA (canastita): pálida y mate en las paredes, dorada solo en las crestas de los
pliegues y en el borde superior, que es donde pegó el horno. Plegada a mano:
ninguna de las tres tiene la misma cantidad ni la misma forma de pliegues.
RELLENO: cubos de jamón cocido rosado entre muzzarella fundida y gratinada, con
hilos de queso y burbujas doradas en la superficie.
CÓMO SE MUESTRA: las tres enteras, con el queso gratinado y el rosa del jamón
asomando por la abertura superior.
```

### 7. Roquefort
```
FORMA: canastita. Base chica y redonda de la que suben paredes de masa, con una
altura parecida al ancho de la base, formando una cazuelita. Las paredes se arman
recogiendo la masa en PLIEGUES VERTICALES sucesivos, como tela fruncida: se
marcan de abajo hacia arriba y dejan el borde superior ondulado e irregular,
nunca liso ni parejo. La boca queda bien abierta, mostrando todo el relleno desde
arriba. No es una media luna, no tiene repulgue trenzado, no se cierra en el
centro y no es una tartaleta de borde liso.
MASA (canastita): pálida y mate en las paredes, dorada solo en las crestas de los
pliegues y en el borde superior, que es donde pegó el horno. Plegada a mano:
ninguna de las tres tiene la misma cantidad ni la misma forma de pliegues.
RELLENO: muzzarella fundida con trozos de queso azul de vetas azul verdosas
apenas derretidos, y alguna mancha dorada del gratinado.
CÓMO SE MUESTRA: las tres enteras. Las vetas azules del queso tienen que
distinguirse con claridad en la abertura: es lo único que identifica el sabor.
```

### 8. Palmito
```
FORMA: canastita. Base chica y redonda de la que suben paredes de masa, con una
altura parecida al ancho de la base, formando una cazuelita. Las paredes se arman
recogiendo la masa en PLIEGUES VERTICALES sucesivos, como tela fruncida: se
marcan de abajo hacia arriba y dejan el borde superior ondulado e irregular,
nunca liso ni parejo. La boca queda bien abierta, mostrando todo el relleno desde
arriba. No es una media luna, no tiene repulgue trenzado, no se cierra en el
centro y no es una tartaleta de borde liso.
MASA (canastita): pálida y mate en las paredes, dorada solo en las crestas de los
pliegues y en el borde superior, que es donde pegó el horno. Plegada a mano:
ninguna de las tres tiene la misma cantidad ni la misma forma de pliegues.
RELLENO: rodajas de palmito blanco marfil entre muzzarella fundida y un ligado
cremoso rosado de salsa golf, gratinado en la superficie.
CÓMO SE MUESTRA: las tres enteras, con al menos una rodaja de palmito bien
visible y reconocible en la abertura de cada una.
```

### 9. Caprese
```
FORMA: canastita. Base chica y redonda de la que suben paredes de masa, con una
altura parecida al ancho de la base, formando una cazuelita. Las paredes se arman
recogiendo la masa en PLIEGUES VERTICALES sucesivos, como tela fruncida: se
marcan de abajo hacia arriba y dejan el borde superior ondulado e irregular,
nunca liso ni parejo. La boca queda bien abierta, mostrando todo el relleno desde
arriba. No es una media luna, no tiene repulgue trenzado, no se cierra en el
centro y no es una tartaleta de borde liso.
MASA (canastita): pálida y mate en las paredes, dorada solo en las crestas de los
pliegues y en el borde superior, que es donde pegó el horno. Plegada a mano:
ninguna de las tres tiene la misma cantidad ni la misma forma de pliegues.
RELLENO: tomate en cubos que perdió agua y brilla, muzzarella fundida y gratinada
en los bordes de la abertura, y unas gotas de pesto verde como acento.
CÓMO SE MUESTRA: las tres enteras. El rojo del tomate y el verde del pesto tienen
que leerse desde arriba, contra el dorado de la masa.
```
