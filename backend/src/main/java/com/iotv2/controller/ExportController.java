package com.iotv2.controller;

import com.iotv2.model.DataSensor;
import com.iotv2.repository.DataSensorRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ExportController {

    private final DataSensorRepository dataSensorRepository;

    @GetMapping("/csv")
    public void exportCsv(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"datasensor.csv\"");

        PrintWriter writer = response.getWriter();
        writer.write('\uFEFF'); // BOM for UTF-8 in Excel
        writer.println("ID,Loại Cảm Biến,Tên Cảm Biến,Giá Trị,Thời Gian");

        List<DataSensor> list = dataSensorRepository.findAll();
        for (DataSensor ds : list) {
            writer.printf("%d,\"%s\",\"%s\",%.2f,\"%s\"%n",
                    ds.getId(),
                    ds.getSensor().getSensorType(),
                    ds.getSensor().getName(),
                    ds.getValue(),
                    ds.getTime());
        }
        writer.flush();
    }
}

