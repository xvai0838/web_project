/**
 * API 模块属性测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { buildRequestBody, drawCompositionLines, getErrorMessage, parseAnalysisResult, addHistoryRecord, getHistoryRecords, saveHistoryRecords, getHistoryRecordById } from './api.js'

/**
 * 分析结果展示所需的五个维度
 */
const REQUIRED_DIMENSIONS = ['composition', 'lighting', 'color', 'subject', 'perspective']

/**
 * 从分析结果中提取展示维度
 * @param {object} result - 分析结果对象
 * @returns {string[]} 包含的维度列表
 */
function extractDisplayDimensions(result) {
  if (!result || typeof result !== 'object') {
    return []
  }
  return REQUIRED_DIMENSIONS.filter(dim => dim in result)
}

/**
 * **Feature: photo-analysis-app, Property 2: API请求格式正确性**
 * **Validates: Requirements 3.1, 6.1**
 * 
 * 对于任意上传的图片，构造的API请求体应符合doubao-seed-1-6-vision模型的规范格式，
 * 包含正确的model字段和messages结构
 */
describe('Property 2: API请求格式正确性', () => {
  it('对于任意base64图片数据，请求体应包含正确的model字段和messages结构', () => {
    fc.assert(
      fc.property(
        // 生成随机的 base64 字符串（模拟图片数据）
        fc.base64String({ minLength: 10, maxLength: 1000 }),
        (base64Image) => {
          const requestBody = buildRequestBody(base64Image)
          
          // 验证 model 字段
          expect(requestBody.model).toBe('doubao-seed-1-6-vision')
          
          // 验证 messages 结构
          expect(requestBody.messages).toBeDefined()
          expect(Array.isArray(requestBody.messages)).toBe(true)
          expect(requestBody.messages.length).toBe(1)
          
          // 验证 message 内容
          const message = requestBody.messages[0]
          expect(message.role).toBe('user')
          expect(Array.isArray(message.content)).toBe(true)
          expect(message.content.length).toBe(2)
          
          // 验证图片内容
          const imageContent = message.content[0]
          expect(imageContent.type).toBe('image_url')
          expect(imageContent.image_url).toBeDefined()
          expect(imageContent.image_url.url).toBeDefined()
          expect(imageContent.image_url.url.startsWith('data:')).toBe(true)
          
          // 验证文本内容
          const textContent = message.content[1]
          expect(textContent.type).toBe('text')
          expect(typeof textContent.text).toBe('string')
          expect(textContent.text.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于已有data:前缀的图片，不应重复添加前缀', () => {
    fc.assert(
      fc.property(
        fc.base64String({ minLength: 10, maxLength: 500 }),
        fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
        (base64Data, mimeType) => {
          const prefixedImage = `data:${mimeType};base64,${base64Data}`
          const requestBody = buildRequestBody(prefixedImage)
          
          const imageUrl = requestBody.messages[0].content[0].image_url.url
          // 不应有重复的 data: 前缀
          expect(imageUrl.match(/data:/g).length).toBe(1)
          // 应保留原始的 MIME 类型
          expect(imageUrl).toBe(prefixedImage)
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * **Feature: photo-analysis-app, Property 3: 构图线绘制正确性**
 * **Validates: Requirements 3.2**
 * 
 * 对于任意包含构图线坐标的分析结果，Canvas绑制函数应在正确的位置绘制所有指定的线条
 */
describe('Property 3: 构图线绘制正确性', () => {
  // 生成有效的构图线坐标（0-100百分比）
  const lineArbitrary = fc.record({
    startX: fc.integer({ min: 0, max: 100 }),
    startY: fc.integer({ min: 0, max: 100 }),
    endX: fc.integer({ min: 0, max: 100 }),
    endY: fc.integer({ min: 0, max: 100 }),
    color: fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffffff')
  })

  it('对于任意构图线数组，应正确计算所有线条的像素坐标', () => {
    fc.assert(
      fc.property(
        fc.array(lineArbitrary, { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        (lines, canvasWidth, canvasHeight) => {
          // 记录绘制调用
          const drawnLines = []
          
          // 创建模拟的 Canvas 上下文
          const mockCtx = {
            lineWidth: 0,
            lineCap: '',
            strokeStyle: '',
            beginPath: () => {},
            moveTo: (x, y) => { drawnLines.push({ type: 'moveTo', x, y }) },
            lineTo: (x, y) => { drawnLines.push({ type: 'lineTo', x, y }) },
            stroke: () => { drawnLines.push({ type: 'stroke' }) },
            drawImage: () => {}
          }
          
          // 创建模拟的 Canvas
          const mockCanvas = {
            width: 0,
            height: 0,
            getContext: () => mockCtx
          }
          
          // 创建模拟的图片
          const mockImage = {
            naturalWidth: canvasWidth,
            naturalHeight: canvasHeight
          }
          
          // 执行绘制
          drawCompositionLines(mockCanvas, mockImage, lines)
          
          // 验证 Canvas 尺寸设置正确
          expect(mockCanvas.width).toBe(canvasWidth)
          expect(mockCanvas.height).toBe(canvasHeight)
          
          // 验证每条线都被绘制
          // 每条线应该有: moveTo, lineTo, stroke
          const moveToCount = drawnLines.filter(d => d.type === 'moveTo').length
          const lineToCount = drawnLines.filter(d => d.type === 'lineTo').length
          const strokeCount = drawnLines.filter(d => d.type === 'stroke').length
          
          expect(moveToCount).toBe(lines.length)
          expect(lineToCount).toBe(lines.length)
          expect(strokeCount).toBe(lines.length)
          
          // 验证坐标计算正确（百分比转像素）
          let lineIndex = 0
          for (let i = 0; i < drawnLines.length; i++) {
            if (drawnLines[i].type === 'moveTo') {
              const line = lines[lineIndex]
              const expectedStartX = (line.startX / 100) * canvasWidth
              const expectedStartY = (line.startY / 100) * canvasHeight
              
              expect(drawnLines[i].x).toBeCloseTo(expectedStartX, 5)
              expect(drawnLines[i].y).toBeCloseTo(expectedStartY, 5)
              
              // 下一个应该是 lineTo
              const lineToCall = drawnLines[i + 1]
              const expectedEndX = (line.endX / 100) * canvasWidth
              const expectedEndY = (line.endY / 100) * canvasHeight
              
              expect(lineToCall.x).toBeCloseTo(expectedEndX, 5)
              expect(lineToCall.y).toBeCloseTo(expectedEndY, 5)
              
              lineIndex++
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于空的构图线数组，不应抛出错误', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 100, max: 1000 }),
        (width, height) => {
          const mockCtx = {
            lineWidth: 0,
            lineCap: '',
            strokeStyle: '',
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            drawImage: () => {}
          }
          
          const mockCanvas = {
            width: 0,
            height: 0,
            getContext: () => mockCtx
          }
          
          const mockImage = {
            naturalWidth: width,
            naturalHeight: height
          }
          
          // 空数组不应抛出错误
          expect(() => drawCompositionLines(mockCanvas, mockImage, [])).not.toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * **Feature: photo-analysis-app, Property 4: 分析结果展示完整性**
 * **Validates: Requirements 3.4**
 * 
 * 对于任意分析结果对象，渲染的文字内容应包含构图、光线、色彩、主体表达、景别与角度全部五个分析维度
 */
describe('Property 4: 分析结果展示完整性', () => {
  // 生成有效的构图线
  const lineArbitrary = fc.record({
    startX: fc.integer({ min: 0, max: 100 }),
    startY: fc.integer({ min: 0, max: 100 }),
    endX: fc.integer({ min: 0, max: 100 }),
    endY: fc.integer({ min: 0, max: 100 }),
    color: fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#ffff00')
  })

  // 生成有效的构图对象
  const compositionArbitrary = fc.record({
    type: fc.constantFrom('三分法', '对角线', '中心构图', '黄金分割', '对称构图'),
    lines: fc.array(lineArbitrary, { minLength: 0, maxLength: 5 }),
    description: fc.string({ minLength: 1, maxLength: 200 })
  })

  // 生成完整的分析结果对象
  const analysisResultArbitrary = fc.record({
    composition: compositionArbitrary,
    lighting: fc.string({ minLength: 1, maxLength: 200 }),
    color: fc.string({ minLength: 1, maxLength: 200 }),
    subject: fc.string({ minLength: 1, maxLength: 200 }),
    perspective: fc.string({ minLength: 1, maxLength: 200 })
  })

  it('对于任意有效的分析结果，应包含全部五个分析维度', () => {
    fc.assert(
      fc.property(
        analysisResultArbitrary,
        (result) => {
          // 提取展示维度
          const dimensions = extractDisplayDimensions(result)
          
          // 验证包含全部五个维度
          expect(dimensions).toHaveLength(5)
          expect(dimensions).toContain('composition')
          expect(dimensions).toContain('lighting')
          expect(dimensions).toContain('color')
          expect(dimensions).toContain('subject')
          expect(dimensions).toContain('perspective')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于任意有效的分析结果JSON字符串，parseAnalysisResult应返回包含全部五个维度的对象', () => {
    fc.assert(
      fc.property(
        analysisResultArbitrary,
        (result) => {
          // 将结果转为JSON字符串（模拟API响应）
          const jsonString = JSON.stringify(result)
          
          // 解析结果
          const parsed = parseAnalysisResult(jsonString)
          
          // 验证解析后的结果包含全部五个维度
          const dimensions = extractDisplayDimensions(parsed)
          expect(dimensions).toHaveLength(5)
          
          // 验证每个维度的内容与原始数据一致
          expect(parsed.composition.type).toBe(result.composition.type)
          expect(parsed.composition.description).toBe(result.composition.description)
          expect(parsed.lighting).toBe(result.lighting)
          expect(parsed.color).toBe(result.color)
          expect(parsed.subject).toBe(result.subject)
          expect(parsed.perspective).toBe(result.perspective)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于缺少任意维度的分析结果，parseAnalysisResult应抛出错误', () => {
    fc.assert(
      fc.property(
        // 生成要移除的维度
        fc.constantFrom('composition', 'lighting', 'color', 'subject', 'perspective'),
        analysisResultArbitrary,
        (dimensionToRemove, result) => {
          // 创建缺少某个维度的结果
          const incompleteResult = { ...result }
          delete incompleteResult[dimensionToRemove]
          
          const jsonString = JSON.stringify(incompleteResult)
          
          // 验证解析时抛出错误
          expect(() => parseAnalysisResult(jsonString)).toThrow(`分析结果缺少必要字段: ${dimensionToRemove}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * **Feature: photo-analysis-app, Property 7: 历史记录持久化**
 * **Validates: Requirements 4.5**
 * 
 * 对于任意新增的分析记录，保存到localStorage后重新读取应得到相同的数据
 */
describe('Property 7: 历史记录持久化', () => {
  // 在每个测试前清空 localStorage
  beforeEach(() => {
    localStorage.clear()
  })

  // 生成有效的构图线
  const lineArbitrary = fc.record({
    startX: fc.integer({ min: 0, max: 100 }),
    startY: fc.integer({ min: 0, max: 100 }),
    endX: fc.integer({ min: 0, max: 100 }),
    endY: fc.integer({ min: 0, max: 100 }),
    color: fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#ffff00')
  })

  // 生成有效的构图对象
  const compositionArbitrary = fc.record({
    type: fc.constantFrom('三分法', '对角线', '中心构图', '黄金分割', '对称构图'),
    lines: fc.array(lineArbitrary, { minLength: 0, maxLength: 5 }),
    description: fc.string({ minLength: 1, maxLength: 200 })
  })

  // 生成完整的分析结果对象
  const analysisResultArbitrary = fc.record({
    composition: compositionArbitrary,
    lighting: fc.string({ minLength: 1, maxLength: 200 }),
    color: fc.string({ minLength: 1, maxLength: 200 }),
    subject: fc.string({ minLength: 1, maxLength: 200 }),
    perspective: fc.string({ minLength: 1, maxLength: 200 })
  })

  // 生成模拟的 base64 图片数据
  const base64ImageArbitrary = fc.base64String({ minLength: 100, maxLength: 500 })
    .map(data => `data:image/jpeg;base64,${data}`)

  it('对于任意分析记录，保存后读取应得到相同的数据', () => {
    fc.assert(
      fc.property(
        base64ImageArbitrary,
        base64ImageArbitrary,
        analysisResultArbitrary,
        (imageData, analysisImage, result) => {
          // 添加历史记录
          const savedRecord = addHistoryRecord(imageData, analysisImage, result)
          
          // 验证返回的记录包含正确的数据
          expect(savedRecord.imageData).toBe(imageData)
          expect(savedRecord.analysisImage).toBe(analysisImage)
          expect(savedRecord.result).toEqual(result)
          expect(savedRecord.id).toBeDefined()
          expect(savedRecord.timestamp).toBeDefined()
          
          // 从 localStorage 重新读取
          const records = getHistoryRecords()
          const retrievedRecord = records.find(r => r.id === savedRecord.id)
          
          // 验证读取的数据与保存的数据一致
          expect(retrievedRecord).toBeDefined()
          expect(retrievedRecord.imageData).toBe(imageData)
          expect(retrievedRecord.analysisImage).toBe(analysisImage)
          expect(retrievedRecord.result).toEqual(result)
          expect(retrievedRecord.id).toBe(savedRecord.id)
          expect(retrievedRecord.timestamp).toBe(savedRecord.timestamp)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于任意分析记录，通过ID查询应返回完整的记录', () => {
    fc.assert(
      fc.property(
        base64ImageArbitrary,
        base64ImageArbitrary,
        analysisResultArbitrary,
        (imageData, analysisImage, result) => {
          // 添加历史记录
          const savedRecord = addHistoryRecord(imageData, analysisImage, result)
          
          // 通过 ID 查询
          const retrievedRecord = getHistoryRecordById(savedRecord.id)
          
          // 验证查询结果
          expect(retrievedRecord).not.toBeNull()
          expect(retrievedRecord.imageData).toBe(imageData)
          expect(retrievedRecord.analysisImage).toBe(analysisImage)
          expect(retrievedRecord.result).toEqual(result)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于多条历史记录，所有记录都应正确持久化', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(base64ImageArbitrary, base64ImageArbitrary, analysisResultArbitrary),
          { minLength: 1, maxLength: 5 }
        ),
        (recordsData) => {
          // 清空之前的记录
          saveHistoryRecords([])
          
          // 添加多条记录
          const savedRecords = recordsData.map(([imageData, analysisImage, result]) => 
            addHistoryRecord(imageData, analysisImage, result)
          )
          
          // 读取所有记录
          const retrievedRecords = getHistoryRecords()
          
          // 验证记录数量一致
          expect(retrievedRecords.length).toBe(savedRecords.length)
          
          // 验证每条记录都正确保存
          for (const saved of savedRecords) {
            const retrieved = retrievedRecords.find(r => r.id === saved.id)
            expect(retrieved).toBeDefined()
            expect(retrieved.imageData).toBe(saved.imageData)
            expect(retrieved.analysisImage).toBe(saved.analysisImage)
            expect(retrieved.result).toEqual(saved.result)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * **Feature: photo-analysis-app, Property 5: 历史记录恢复正确性**
 * **Validates: Requirements 4.3**
 * 
 * 对于任意存储的历史记录，选择该记录后应完整恢复原图、分析图和所有分析结果数据
 */
describe('Property 5: 历史记录恢复正确性', () => {
  // 在每个测试前清空 localStorage
  beforeEach(() => {
    localStorage.clear()
  })

  // 生成有效的构图线
  const lineArbitrary = fc.record({
    startX: fc.integer({ min: 0, max: 100 }),
    startY: fc.integer({ min: 0, max: 100 }),
    endX: fc.integer({ min: 0, max: 100 }),
    endY: fc.integer({ min: 0, max: 100 }),
    color: fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#ffff00')
  })

  // 生成有效的构图对象
  const compositionArbitrary = fc.record({
    type: fc.constantFrom('三分法', '对角线', '中心构图', '黄金分割', '对称构图'),
    lines: fc.array(lineArbitrary, { minLength: 0, maxLength: 5 }),
    description: fc.string({ minLength: 1, maxLength: 200 })
  })

  // 生成完整的分析结果对象
  const analysisResultArbitrary = fc.record({
    composition: compositionArbitrary,
    lighting: fc.string({ minLength: 1, maxLength: 200 }),
    color: fc.string({ minLength: 1, maxLength: 200 }),
    subject: fc.string({ minLength: 1, maxLength: 200 }),
    perspective: fc.string({ minLength: 1, maxLength: 200 })
  })

  // 生成模拟的 base64 图片数据
  const base64ImageArbitrary = fc.base64String({ minLength: 100, maxLength: 500 })
    .map(data => `data:image/jpeg;base64,${data}`)

  it('对于任意存储的历史记录，通过ID恢复应返回完整的原图、分析图和分析结果', () => {
    fc.assert(
      fc.property(
        base64ImageArbitrary,
        base64ImageArbitrary,
        analysisResultArbitrary,
        (imageData, analysisImage, result) => {
          // 添加历史记录
          const savedRecord = addHistoryRecord(imageData, analysisImage, result)
          
          // 通过 ID 恢复记录
          const restoredRecord = getHistoryRecordById(savedRecord.id)
          
          // 验证恢复的记录不为空
          expect(restoredRecord).not.toBeNull()
          expect(restoredRecord).toBeDefined()
          
          // 验证原图数据完整恢复
          expect(restoredRecord.imageData).toBe(imageData)
          
          // 验证分析图数据完整恢复
          expect(restoredRecord.analysisImage).toBe(analysisImage)
          
          // 验证分析结果完整恢复 - 包含全部五个维度
          expect(restoredRecord.result).toBeDefined()
          expect(restoredRecord.result.composition).toEqual(result.composition)
          expect(restoredRecord.result.lighting).toBe(result.lighting)
          expect(restoredRecord.result.color).toBe(result.color)
          expect(restoredRecord.result.subject).toBe(result.subject)
          expect(restoredRecord.result.perspective).toBe(result.perspective)
          
          // 验证构图详细信息完整恢复
          expect(restoredRecord.result.composition.type).toBe(result.composition.type)
          expect(restoredRecord.result.composition.description).toBe(result.composition.description)
          expect(restoredRecord.result.composition.lines).toEqual(result.composition.lines)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于任意存储的历史记录，恢复后的数据应与原始保存的数据完全一致', () => {
    fc.assert(
      fc.property(
        base64ImageArbitrary,
        base64ImageArbitrary,
        analysisResultArbitrary,
        (imageData, analysisImage, result) => {
          // 添加历史记录
          const savedRecord = addHistoryRecord(imageData, analysisImage, result)
          
          // 通过 ID 恢复记录
          const restoredRecord = getHistoryRecordById(savedRecord.id)
          
          // 验证恢复的记录与保存时返回的记录完全一致
          expect(restoredRecord.id).toBe(savedRecord.id)
          expect(restoredRecord.timestamp).toBe(savedRecord.timestamp)
          expect(restoredRecord.imageData).toBe(savedRecord.imageData)
          expect(restoredRecord.analysisImage).toBe(savedRecord.analysisImage)
          expect(restoredRecord.result).toEqual(savedRecord.result)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('对于多条历史记录，任意一条都应能正确恢复', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(base64ImageArbitrary, base64ImageArbitrary, analysisResultArbitrary),
          { minLength: 2, maxLength: 5 }
        ),
        fc.nat(),
        (recordsData, indexSeed) => {
          // 清空之前的记录
          saveHistoryRecords([])
          
          // 添加多条记录
          const savedRecords = recordsData.map(([imageData, analysisImage, result]) => 
            addHistoryRecord(imageData, analysisImage, result)
          )
          
          // 随机选择一条记录进行恢复
          const selectedIndex = indexSeed % savedRecords.length
          const selectedRecord = savedRecords[selectedIndex]
          
          // 通过 ID 恢复记录
          const restoredRecord = getHistoryRecordById(selectedRecord.id)
          
          // 验证恢复的记录完整且正确
          expect(restoredRecord).not.toBeNull()
          expect(restoredRecord.imageData).toBe(selectedRecord.imageData)
          expect(restoredRecord.analysisImage).toBe(selectedRecord.analysisImage)
          expect(restoredRecord.result).toEqual(selectedRecord.result)
          
          // 验证分析结果包含全部五个维度
          expect(restoredRecord.result.composition).toBeDefined()
          expect(restoredRecord.result.lighting).toBeDefined()
          expect(restoredRecord.result.color).toBeDefined()
          expect(restoredRecord.result.subject).toBeDefined()
          expect(restoredRecord.result.perspective).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
