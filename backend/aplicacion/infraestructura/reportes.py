from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from .reporte_asistencia import (
    construir_reporte_asistencia, preparar_hoja, titulo, cabecera, tabla, texto_seguro,
)


def construir_excel(filas, tipo, detalle=None, desde=None, hasta=None, filtros=""):
    if tipo == "asistencia":
        return construir_reporte_asistencia(filas, desde, hasta, filtros)
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Preplanilla estimada"
    campos = ["codigo", "nombre", "horas_programadas", "horas_permanencia", "minutos_tardanza", "faltas",
              "dias_incompletos", "dias_tardanza", "tarifa_hora", "importe_estimado", "descuento_referencial"]
    etiquetas = ["ID institucional", "Docente", "Horas programadas", "Permanencia (h)", "Tardanza (min)", "Faltas",
                 "Días incompletos", "Días tarde", "Tarifa por hora (S/)", "Importe estimado (S/)", "Descuento referencial (S/)"]
    periodo = f"Del {desde:%d/%m/%Y} al {hasta:%d/%m/%Y}" if desde and hasta else "Resultados de la consulta"
    preparar_hoja(hoja, [22, 40, 18, 18, 18, 12, 18, 14, 20, 23, 25])
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A4
    titulo(hoja, "Preplanilla docente estimada", periodo, len(campos))
    hoja.merge_cells("A4:K4")
    hoja["A4"] = "Estimación referencial de permanencia. No constituye planilla de pago ni aplica descuentos automáticamente."
    hoja["A4"].font = Font(name="Calibri", size=10, color="505968")
    hoja["A4"].alignment = Alignment(wrap_text=True, vertical="center")
    hoja.row_dimensions[4].height = 32
    cabecera(hoja, 6, etiquetas)
    for numero, registro in enumerate(filas, 7):
        for indice, campo in enumerate(campos, 1):
            valor = registro.get(campo)
            if campo == "tarifa_hora" and not registro.get("tarifa_configurada", True):
                valor = "Sin tarifa"
            celda = hoja.cell(numero, indice, texto_seguro(valor))
            celda.font = Font(name="Calibri", size=11, color="1C1C1E")
            celda.fill = PatternFill("solid", fgColor="F4F7FC" if numero % 2 else "FFFFFF")
            celda.alignment = Alignment(vertical="center", horizontal="left" if indice < 3 else "right", wrap_text=True)
            celda.number_format = '"S/ "#,##0.00' if indice >= 9 else '0.00' if indice in (3, 4) else 'General'
        hoja.row_dimensions[numero].height = 34
    if not filas:
        hoja.merge_cells("A7:K7")
        hoja["A7"] = "No hay docentes en el periodo consultado."
    hoja.freeze_panes = "C7"
    hoja.auto_filter.ref = f"A6:K{max(6, 6 + len(filas))}"
    hoja.print_title_rows = "1:6"
    hoja.print_area = f"A1:K{hoja.max_row}"
    if detalle is not None:
        diaria = libro.create_sheet("Detalle diario")
        campos_detalle = ["codigo", "nombre", "fecha", "entrada", "salida", "estado", "minutos_tardanza", "horas_programadas", "horas_permanencia"]
        tabla(diaria, detalle, campos_detalle,
              ["ID institucional", "Docente", "Fecha", "Entrada", "Salida", "Estado", "Tardanza (min)", "Horas programadas", "Permanencia (h)"], periodo)
    archivo = BytesIO()
    libro.save(archivo)
    archivo.seek(0)
    return archivo
