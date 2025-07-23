// 🧪 Test Simple - Verificación de Jest
// Test básico para verificar que el sistema de testing funciona

describe('🧪 Test Simple', () => {
  it('debería sumar correctamente', () => {
    expect(2 + 2).toBe(4);
  });

  it('debería manejar strings', () => {
    const message = 'Hola mundo';
    expect(message).toContain('Hola');
    expect(message.length).toBeGreaterThan(0);
  });

  it('debería manejar arrays', () => {
    const array = [1, 2, 3, 4, 5];
    expect(array).toHaveLength(5);
    expect(array).toContain(3);
  });

  it('debería manejar objetos', () => {
    const obj = {
      name: 'Test',
      value: 42,
      active: true
    };

    expect(obj).toHaveProperty('name');
    expect(obj.name).toBe('Test');
    expect(obj.value).toBe(42);
    expect(obj.active).toBe(true);
  });

  it('debería manejar async/await', async () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    const start = Date.now();
    await delay(10);
    const end = Date.now();
    
    expect(end - start).toBeGreaterThanOrEqual(5);
  });
}); 