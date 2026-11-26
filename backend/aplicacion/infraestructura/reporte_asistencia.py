from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins
from openpyxl.comments import Comment

AZUL = "003397"
MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
ESTADOS = {"Puntual": ("A", "E5F7E9", "176B2C"), "Tardanza": ("T", "FFF3DF", "8A4B00"), "Falta": ("F", "FFEBE9", "B42318"), "Justificado": ("J", "EDF3FF", AZUL), "Pendiente": ("P", "F2F2F7", "666666"), "No programado": ("—", "E9EDF5", "666666")}


def texto_seguro(valor):
    if isinstance(valor, str) and valor.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + valor
    return valor


def preparar_hoja(hoja, columnas):
    hoja.sheet_view.showGridLines = False
    hoja.sheet_properties.pageSetUpPr.fitToPage = True
    hoja.page_setup.orientation = "landscape"
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A3
    hoja.page_setup.fitToWidth = 1
    hoja.page_setup.fitToHeight = 0
    hoja.oddFooter.center.text = "FyM Pass · Página &P de &N"
    hoja.print_options.horizontalCentered = True
    hoja.sheet_view.zoomScale = 85
    hoja.page_margins = PageMargins(left=0.25, right=0.25, top=0.4, bottom=0.4, header=0.15, footer=0.2)
    hoja.oddFooter.left.text = "Asistencia de ingreso al instituto"
    for indice, ancho in enumerate(columnas, 1):
        hoja.column_dimensions[get_column_letter(indice)].width = ancho


def titulo(hoja, texto, periodo, ultima):
    for fila, valor in [(1, "ISTP FINNEY Y MILLER · FyM Pass"), (2, texto), (3, periodo)]:
        hoja.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=ultima)
        celda = hoja.cell(fila, 1, valor)
        celda.font = Font(name="Calibri", size=16 if fila == 2 else 11, bold=fila != 3, color="FFFFFF" if fila != 3 else AZUL)
        celda.fill = PatternFill("solid", fgColor=AZUL if fila != 3 else "EDF3FF")
        celda.alignment = Alignment(vertical="center", wrap_text=True)
        hoja.row_dimensions[fila].height = 36 if fila == 3 else 30 if fila == 2 else 24


def cabecera(hoja, fila, valores):
    for indice, valor in enumerate(valores, 1):
        celda = hoja.cell(fila, indice, valor)
        celda.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor=AZUL)
        celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    hoja.row_dimensions[fila].height = 36


def tabla(hoja, filas, campos, etiquetas, periodo):
    preparar_hoja(hoja, [38 if campo == "nombre" else 27 if campo in ("entrada", "salida") else 24 if campo in ("carrera", "grupo") else 18 for campo in campos])
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A4
    titulo(hoja, "Detalle de asistencia al instituto", periodo, len(campos))
    cabecera(hoja, 5, etiquetas)
    for numero, registro in enumerate(filas, 6):
        for indice, campo in enumerate(campos, 1):
            valor = registro.get(campo)
            if campo == "fecha" and valor:
                valor = date.fromisoformat(valor)
            elif campo in ("entrada", "salida") and valor:
                valor = datetime.fromisoformat(valor.replace("Z", "+00:00")).astimezone(ZoneInfo("America/Lima")).replace(tzinfo=None)
            elif campo == "salida" and not registro.get("requiere_salida", True):
                valor = "No aplica"
            celda = hoja.cell(numero, indice, texto_seguro(valor))
            celda.font = Font(name="Calibri", size=11, color="1C1C1E")
            celda.fill = PatternFill("solid", fgColor="F4F7FC" if numero % 2 == 0 else "FFFFFF")
            celda.alignment = Alignment(vertical="center", wrap_text=campo in ("nombre", "grupo", "carrera"))
            if campo == "fecha":
                celda.number_format = "dd/mm/yyyy"
            elif campo in ("entrada", "salida"):
                celda.number_format = "dd/mm/yyyy h:mm AM/PM"
            elif campo in ("horas_programadas", "horas_permanencia"):
                celda.number_format = "0.00"
            if campo == "estado" and valor in ESTADOS:
                _, fondo, tinta = ESTADOS[valor]
                celda.fill = PatternFill("solid", fgColor=fondo)
                celda.font = Font(color=tinta)
        hoja.row_dimensions[numero].height = 32
    hoja.freeze_panes = "D6"
    hoja.auto_filter.ref = f"A5:{get_column_letter(len(campos))}{max(5, hoja.max_row)}"
    hoja.print_title_rows = "1:5"
    hoja.print_area = f"A1:{get_column_letter(len(campos))}{hoja.max_row}"


def construir_reporte_asistencia(filas, desde=None, hasta=None, filtros=""):
    libro = Workbook()
    resumen = libro.active
    resumen.title = "Consolidado"
    periodo = f"Del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y}" if desde and hasta else "Resultados de la consulta"
    if filtros:
        periodo += " · " + filtros
    campos_resumen = ["N.º", "ID institucional", "Nombre completo", "Rol", "Ingresos", "Días tarde", "Tardanza (min)", "Faltas", "Justificados", "Sin salida"]
    preparar_hoja(resumen, [7, 23, 42, 26, 13, 13, 17, 12, 14, 13])
    resumen.page_setup.paperSize = resumen.PAPERSIZE_A4
    titulo(resumen, "Consolidado de asistencia", periodo, 10)
    resumen.merge_cells("A4:J4")
    resumen["A4"] = "Solo se cuentan los resultados incluidos en la consulta. Tardanzas justificadas excluidas del total de minutos."
    resumen["A4"].font = Font(size=10, color="666666")
    resumen["A4"].alignment = Alignment(wrap_text=True)
    resumen.row_dimensions[4].height = 30
    cabecera(resumen, 6, campos_resumen)
    personas = defaultdict(list)
    for fila in filas:
        personas[fila["persona_id"]].append(fila)
    for numero, registros in enumerate(sorted(personas.values(), key=lambda datos: (datos[0]["rol"], datos[0]["nombre"])), 1):
        persona = registros[0]
        valores = [numero, persona["codigo"], persona["nombre"], persona["rol"], sum(bool(d["entrada"]) for d in registros), sum(d["estado"] == "Tardanza" for d in registros), sum(d["minutos_tardanza"] for d in registros if d["estado"] == "Tardanza"), sum(d["estado"] == "Falta" for d in registros), sum(d["estado"] == "Justificado" for d in registros), sum(bool(d["entrada"]) and not d["salida"] and d.get("requiere_salida", False) for d in registros)]
        for indice, valor in enumerate(valores, 1):
            celda = resumen.cell(numero + 6, indice, texto_seguro(valor))
            celda.font = Font(name="Calibri", size=11, color="1C1C1E")
            celda.fill = PatternFill("solid", fgColor="F4F7FC" if numero % 2 else "FFFFFF")
            celda.alignment = Alignment(vertical="center", wrap_text=indice in (3, 4))
        resumen.row_dimensions[numero + 6].height = 32
    if not filas:
        resumen.merge_cells("A7:J7")
        resumen["A7"] = "No hay registros para esta consulta."
    resumen.freeze_panes = "E7"
    resumen.auto_filter.ref = f"A6:J{max(6, 6 + len(personas))}"
    resumen.print_title_rows = "1:6"
    resumen.print_area = f"A1:J{resumen.max_row}"
    meses_roles = defaultdict(list)
    for fila in filas:
        meses_roles[(fila["fecha"][:7], fila["rol_codigo"])].append(fila)
    for (mes, rol), registros in sorted(meses_roles.items()):
        anio, numero_mes = map(int, mes.split("-"))
        dias = monthrange(anio, numero_mes)[1]
        etiqueta_rol = {"docente": "Docentes", "administrativo": "Administrativos"}.get(rol, "Personal")
        hoja = libro.create_sheet(f"{mes} {etiqueta_rol}"[:31])
        preparar_hoja(hoja, [6, 22, 38, 26] + [4.5] * dias)
        titulo(hoja, f"{etiqueta_rol} · {MESES[numero_mes]} {anio}", periodo, dias + 4)
        hoja.merge_cells(start_row=4, start_column=1, end_row=4, end_column=dias + 4)
        hoja.cell(4, 1, "A: ingreso puntual · T: tardanza · F: falta · J: justificado · P: pendiente · —: no programado · ·: fuera del resultado filtrado")
        hoja.cell(4, 1).font = Font(size=10, color="444444")
        hoja.cell(4, 1).alignment = Alignment(wrap_text=True)
        hoja.row_dimensions[4].height = 30
        cabecera(hoja, 6, ["N.º", "ID institucional", "Nombre completo", "Rol"] + list(range(1, dias + 1)))
        for dia in range(1, dias + 1):
            celda = hoja.cell(7, dia + 4, ["L", "M", "X", "J", "V", "S", "D"][date(anio, numero_mes, dia).weekday()])
            celda.fill = PatternFill("solid", fgColor="EDF3FF")
            if date(anio, numero_mes, dia).weekday() >= 5:
                celda.fill = PatternFill("solid", fgColor="D8DFEB")
            celda.alignment = Alignment(horizontal="center")
        grupos = defaultdict(dict)
        for registro in registros:
            grupos[registro["persona_id"]][int(registro["fecha"][-2:])] = registro
        for numero, mapa in enumerate(sorted(grupos.values(), key=lambda datos: next(iter(datos.values()))["nombre"]), 1):
            persona = next(iter(mapa.values()))
            grupo = persona["rol"]
            fila_excel = numero + 7
            for indice, valor in enumerate([numero, persona["codigo"], persona["nombre"], grupo], 1):
                celda = hoja.cell(fila_excel, indice, texto_seguro(valor))
                celda.font = Font(name="Calibri", size=10)
                celda.alignment = Alignment(vertical="center", wrap_text=True)
            for dia in range(1, dias + 1):
                registro = mapa.get(dia)
                simbolo, fondo, tinta = ESTADOS.get(registro["estado"], ("?", "FFFFFF", "1C1C1E")) if registro else ("·", "F2F2F7", "888888")
                celda = hoja.cell(fila_excel, dia + 4, simbolo)
                celda.fill = PatternFill("solid", fgColor=fondo)
                celda.font = Font(name="Calibri", size=11, bold=bool(registro), color=tinta)
                celda.alignment = Alignment(horizontal="center", vertical="center")
                celda.border = Border(bottom=Side(style="hair", color="D8DFEB"))
                if registro:
                    def hora_visible(valor):
                        return datetime.fromisoformat(valor.replace("Z", "+00:00")).astimezone(ZoneInfo("America/Lima")).strftime("%I:%M %p") if valor else "Sin registro"
                    celda.comment = Comment(f"{registro['estado']}\nEntrada: {hora_visible(registro.get('entrada'))}\nSalida: {hora_visible(registro.get('salida'))}\nTardanza: {registro.get('minutos_tardanza', 0)} min", "FyM Pass")
            hoja.row_dimensions[fila_excel].height = 34
        hoja.freeze_panes = "E8"
        hoja.auto_filter.ref = f"A6:{get_column_letter(dias + 4)}{hoja.max_row}"
        hoja.print_title_rows = "1:7"
        hoja.print_area = f"A1:{get_column_letter(dias + 4)}{hoja.max_row}"
    diaria = libro.create_sheet("Detalle diario")
    campos = ["codigo", "nombre", "rol", "fecha", "entrada", "salida", "estado", "minutos_tardanza", "horas_programadas", "horas_permanencia"]
    tabla(diaria, filas, campos, ["ID institucional", "Nombre completo", "Rol", "Fecha", "Entrada", "Salida", "Estado", "Tardanza (min)", "Horas programadas", "Permanencia (h)"], periodo)
    archivo = BytesIO()
    libro.save(archivo)
    archivo.seek(0)
    return archivo
