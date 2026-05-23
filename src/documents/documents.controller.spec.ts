import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;

  const mockDocumentsService = {
    registerDocument: jest.fn().mockResolvedValue({
      success: true,
      status: 'pending',
      message: 'Documento encolado para registro en blockchain',
      hash: '0xabc123',
      jobId: '1',
    }),
    verifyDocument: jest
      .fn()
      .mockResolvedValue({ success: true, isVerified: true, hash: '0xabc123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('debe registrar un documento correctamente', async () => {
    const hash = '0xabc123';
    const dto = { hash };
    const result = await controller.registerDocument(dto);

    expect(mockDocumentsService.registerDocument).toHaveBeenCalledWith(hash);
    expect(result).toEqual({
      success: true,
      status: 'pending',
      message: 'Documento encolado para registro en blockchain',
      hash: '0xabc123',
      jobId: '1',
    });
  });

  it('debe verificar un documento correctamente', async () => {
    const hash = '0xabc123';
    const dto = { hash };
    const result = await controller.verifyDocument(dto);

    expect(mockDocumentsService.verifyDocument).toHaveBeenCalledWith(hash);
    expect(result).toEqual({
      success: true,
      isVerified: true,
      hash: '0xabc123',
    });
  });
});
