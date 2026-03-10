const patientService = require('../../services/PatientService');
const patientRepository = require('../../repositories/PatientRepository');
const crypto = require('crypto');

// Mock the repository using Jest
jest.mock('../../repositories/PatientRepository');

describe('PatientService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createPatient', () => {
        it('should throw an error if missing required fields', async () => {
            const incompleteData = { name: 'John Doe' }; // Missing mrn, dob, etc.
            
            await expect(patientService.createPatient(incompleteData)).rejects.toThrow('Missing required fields');
            expect(patientRepository.create).not.toHaveBeenCalled();
        });

        it('should create a patient and return the object with an active status', async () => {
            const validData = {
                name: 'Jane Doe',
                mrn: 'MRN-9999',
                bedNumber: '100A',
                dob: '1990-01-01',
                diagnosis: 'Flu'
            };

            patientRepository.create.mockResolvedValue({
                ...validData,
                id: 'mock-uuid',
                careIntensity: 1,
                status: 'active'
            });

            const result = await patientService.createPatient(validData);

            expect(patientRepository.create).toHaveBeenCalledTimes(1);
            expect(result.status).toBe('active');
            expect(result.name).toBe('Jane Doe');
        });
    });

    describe('dischargePatient', () => {
        it('should throw an error if patient is not found in database', async () => {
            patientRepository.updateStatus.mockResolvedValue(0); // 0 rows changed implies not found

            await expect(patientService.dischargePatient('invalid-id')).rejects.toThrow('Patient not found');
            expect(patientRepository.updateStatus).toHaveBeenCalledWith('invalid-id', 'discharged');
        });

        it('should update the patient status to discharged', async () => {
            patientRepository.updateStatus.mockResolvedValue(1); // 1 row changed implies success

            const result = await patientService.dischargePatient('valid-id');
            expect(result.message).toBe('Patient discharged successfully');
        });
    });
});
