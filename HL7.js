const fs = require("fs");
const message = fs.readFileSync("1.hl7", "utf-8");

function parseHL7(message) {

  const lines = message.trim().split(/\r?\n/);

  const result = {
    header: {},
    patient: {},
    order: {},
    observations: []
  };

  for (const line of lines) {
    const parts = line.split('|');
    const segmentType = parts[0];

    switch (segmentType) {
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

      case 'OBR':
        result.order = {
          orderNumber: parts[3],
          testName: parts[4],
          dateTime: parts[7]
        };
        break;

      case 'OBX':
        result.observations.push({
          id: parts[1],
          type: parts[2],
          name: parts[3]?.split('^')[1],
          value: parts[5],
          unit: parts[6],
          referenceRange: parts[7],
          flag: parts[8]
        });
        break;

      default:
        // Unknown segment, just skip
        break;
    }
  }

  return result;
}

console.log(parseHL7(message));

// Export for use in other files
module.exports = { parseHL7 };
