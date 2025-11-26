const fs = require("fs");
const message = fs.readFileSync("1.hl7", "utf-8");

function parseHL7(message) {
//Divide el mensjae por lineas
  const lines = message.trim().split(/\r?\n/);
//Objeto resultado con estructura fija
  const result = {
    header: {},
    patient: {},
    order: {},
    observations: []
  };
  //Procesa linea por linea
  for (const line of lines) {
    //Cada segmento HL7 se separa por | 
    const parts = line.split('|');
    const segmentType = parts[0];

    switch (segmentType) {
      //MSH - Encabezado del mensaje
      case 'MSH':
        result.header = {
          sendingApp: parts[2],
          sendingFacility: parts[3],
          receivingApp: parts[4],
          receivingFacility: parts[5],
          messageDate: parts[6],
          messageType: parts[8],
          messageControlId: parts[9],
          version: parts[11]
        };
        break;
        //PID - Informacion del paciente
      case 'PID':
        result.patient = {
          id: parts[3],
          lastName: parts[5]?.split('^')[0],
          firstName: parts[5]?.split('^')[1],
          birthDate: parts[7],
          gender: parts[8],
          address: parts[11]
        };
        break;
        //OBR - Orden de laboratorio
      case 'OBR':
        result.order = {
          orderNumber: parts[3],
          testName: parts[4],
          dateTime: parts[7]
        };
        break;
        //OBX - Resultados/Observaciones
        //Puede haber multiples
      case 'OBX':
        result.observations.push({
          id: parts[1],
          type: parts[2],
          name: parts[3]?.split('^')[1],//Nombre del examen
          value: parts[5],
          unit: parts[6],
          referenceRange: parts[7],//H = alto, L = bajo, etc.
          flag: parts[8]
        });
        break;
        //Otros segmentos se ignoran
      default:
        break;
    }
  }

  return result;
}

module.exports = { parseHL7 };
