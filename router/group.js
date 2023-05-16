const router = require("express").Router()
const db = require("../modules/mysql")
const uuid = require('uuid');
const shortid = require('shortid');
const cron = require('node-cron');

const accessVerify = require("../modules/access_verify")
const refreshVerify = require("../modules/refresh_verify")
const newAccessToken = require("../modules/new_access_token")
const updateRefreshToken = require("../modules/update_refresh_token")


//그룹 새성 api 
router.post("/", async(req, res) => {

    //초대 코드 만들기 
    shortid.characters(process.env.INVISI_CH)
    const inviteCode = shortid.generate(uuid.v4())

    // Request Data
    const groupNameValue = req.body.group_name
    const startTimeValue = req.body.start_time
    const endTimeValue = req.body.end_time
    const is_foodValue = req.body.is_food
    const is_trafficValue = req.body.is_traffic
    console.log(groupNameValue, startTimeValue, endTimeValue, is_foodValue,is_trafficValue , req.body)

    const refreshTokenValue = req.headers.authorization
    const accessTokenValue = req.headers.authorization
    
    // Response Data
    const result = {
        "success": false,
        "message": null,
        "invite_code": null
    }

    try{
        if(groupNameValue === undefined || groupNameValue === null || groupNameValue === ""){
            throw new Error("그룹 이름 값이 올바르지 않습니다.")
        }else if (startTimeValue === undefined || startTimeValue === null || startTimeValue === ""){
            throw new Error("시작 시간 값이 올바르지 않습니다.")
        }else if(endTimeValue === undefined || endTimeValue === null || endTimeValue === ""){
            throw new Error("끝 시간 값이 올바르지 않습니다.")
        }else if(is_foodValue === undefined || is_foodValue === null || is_foodValue === ""){
            throw new Error("음식 선택 값이 올바르지 않습니다.")
        }else if(is_trafficValue === undefined || is_trafficValue === null || is_trafficValue === ""){
            throw new Error("교통 선택 값이 올바르지 않습니다.")
        } else{
       
            if(accessTokenValue !== undefined || refreshTokenValue !== undefined){ 

                const accountIndexValue = accessVerify(accessTokenValue).payload

                if(accessVerify(accessTokenValue).success === true){//treu일 경우-> access_token이 유효한 경우 
                    
                    if(refreshVerify(refreshTokenValue).message === "token expired"){
                        const temp = await updateRefreshToken(accountIndexValue)
                        console.log("여기동",temp)
                        res.send(temp)
                    }else{
                    
                        const connection = await db.getConnection()
                        const groupSql = `
                            CREATE TABLE \`${groupNameValue}\` (
                                groud_join_index INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
                                group_index INT REFERENCES carbon_group(group_index),
                                account_index INT REFERENCES account(account_index),
                                total_carbon INT DEFAULT 0
                            );
                            
                        `
                        await connection.query(groupSql)

                      //group table에 insert 하기 
                       const insertSql =`
                            INSERT INTO carbon_group(group_name,manager_account,start_date, end_data,invite_code, is_food,is_traffic) VALUES(?, ?, ?, ?, ?, ?, ?) 
                       `
                       const values =[groupNameValue, accountIndexValue, startTimeValue, endTimeValue, inviteCode, is_foodValue, is_trafficValue]
                       await connection.query(insertSql, values)

                       result.success = true
                       result.invite_code = inviteCode
                       result.message="group 생성."

                        connection.release()
                        res.send(result)
                    }
                
                }else if(accessVerify(accessTokenValue).message === "token expired"){//access_token이 완료된 경우 
                    //refresh_token이 유효한 경우 
                    if(refreshVerify(refreshTokenValue)){//true 인 경우 -> refresh_token이 유효한 경우 새로운 access_token생성
                        const accountIndexValue = refreshVerify(refreshTokenValue).payload
                        const temp = await newAccessToken(accountIndexValue, refreshTokenValue)
                        res.send(temp)

                    }else{
                        throw new Error("모든 토큰이 완료 되었습니다.")
                    }

                }else{
                    throw new Error("토큰이 올바르지 않습니다.")
                }
            }else{
                throw new Error("토큰이 올바르지 않습니다.")
            }
        }
    }catch(e){
        result.message = e.message
        console.log("POST /group API ERR : ", e.message)
    }

})


// 초대코드 확인 후 참여 확인 
router.post("/join", async(req, res) => {
   
    // Request Data
    const inviteCodeValue = req.body.invite_code    
    console.log(inviteCodeValue , "그룹 참여 api")
    const refreshTokenValue = req.headers.authorization
    const accessTokenValue = req.headers.authorization
    
    // Response Data
    const result = {
        "success": false,
        "message": null
    }

    try{
        if(inviteCodeValue === undefined || inviteCodeValue === null || inviteCodeValue === ""){
            throw new Error("초대코드 값이 올바르지 않습니다.")
        }else{
       
            if(accessTokenValue !== undefined || refreshTokenValue !== undefined){ 

                const accountIndexValue = accessVerify(accessTokenValue).payload

                if(accessVerify(accessTokenValue).success === true){//treu일 경우-> access_token이 유효한 경우 
                    
                    if(refreshVerify(refreshTokenValue).message === "token expired"){
                        const temp = await updateRefreshToken(accountIndexValue)
                        res.send(temp)
                    }else{
                    
                        const connection = await db.getConnection()
                         //invite code & 그룹 이름 가져오기 
                        const selceSql = `
                            SELECT invite_code, group_name FROM carbon_group WHERE invite_code = ?
                        `
                        const selectValues = [inviteCodeValue]
                        const [rows] =await connection.query(selceSql, selectValues)
                        //그룹이름, 초대 초드 
                        const tempInviteCode = rows[0].invite_code
                        const groupNameValue = rows[0].group_name

                        if(tempInviteCode === inviteCodeValue){
                            const sql = `
                                INSERT INTO \`${groupNameValue}\` (account_index) VALUES(?)
                            `
                            const values =[accountIndexValue]
                            await connection.query(sql, values)
                            result.success = true
                            result.message="가입 성공."

                        }
                        

                        connection.release()
                        res.send(result)
                    }
                
                }else if(accessVerify(accessTokenValue).message === "token expired"){//access_token이 완료된 경우 
                    //refresh_token이 유효한 경우 
                    if(refreshVerify(refreshTokenValue)){//true 인 경우 -> refresh_token이 유효한 경우 새로운 access_token생성
                        const accountIndexValue = refreshVerify(refreshTokenValue).payload
                        const temp = await newAccessToken(accountIndexValue, refreshTokenValue)
                        res.send(temp)

                    }else{
                        throw new Error("모든 토큰이 완료 되었습니다.")
                    }

                }else{
                    throw new Error("토큰이 올바르지 않습니다.")
                }
            }else{
                throw new Error("토큰이 올바르지 않습니다.")
            }
        }
    }catch(e){
        result.message = e.message
        console.log("POST /group/join API ERR : ", e.message)
    }

})

// 그룹 랭킹 가져오기 
router.get("/ranking", async(req, res) => {

    // Request Data
    const groupNameValue = req.query.group_name
    
    const refreshTokenValue = req.headers.refresh_token
    const accessTokenValue = req.headers.access_token
    
    // Response Data
    const result = {
        "success": false,
        "data":null,
        "message": null
    }

    try{
        if(groupNameValue === undefined || groupNameValue === null || groupNameValue === ""){
            throw new Error("그룹 이름 값이 올바르지 않습니다.")
        }else{
       
            if(accessTokenValue !== undefined || refreshTokenValue !== undefined){ 

                const accountIndexValue = accessVerify(accessTokenValue).payload

                if(accessVerify(accessTokenValue).success === true){//treu일 경우-> access_token이 유효한 경우 
                    
                    if(refreshVerify(refreshTokenValue).message === "token expired"){
                        const temp = await updateRefreshToken(accountIndexValue)
                        res.send(temp)
                    }else{
                    
                        const connection = await db.getConnection()
                       //랭킹 api 호출 시 사용자 update total_carbon 한다음 select 하기 
                       const updateSql = `
                            UPDATE \`${groupNameValue}\`  SET total_carbon = (
                                SELECT SUM(food_carbon)
                                FROM carbon JOIN \`${groupNameValue}\` ON carbon.account_index = \`${groupNameValue}\`.account_index
                                WHERE account_index = carbon.account_index
                            )
                       `
                       await connection.query(updateSql)


                        const sql = `
                            SELECT user_name, total_carbon FROM \`${groupNameValue}\` JOIN account 
                            ON \`${groupNameValue}\`.account_index = account.account_index ORDER BY total_carbon ASC
                        `
                        const [rows ] =await connection.query(sql)

                        result.success = true
                    
                        result.message="성공"
                        result.data = rows
                        connection.release()
                        res.send(result)
                        
                    }
                
                }else if(accessVerify(accessTokenValue).message === "token expired"){//access_token이 완료된 경우 
                    //refresh_token이 유효한 경우 
                    if(refreshVerify(refreshTokenValue)){//true 인 경우 -> refresh_token이 유효한 경우 새로운 access_token생성
                        const accountIndexValue = refreshVerify(refreshTokenValue).payload
                        const temp = await newAccessToken(accountIndexValue, refreshTokenValue)
                        res.send(temp)

                    }else{
                        throw new Error("모든 토큰이 완료 되었습니다.")
                    }

                }else{
                    throw new Error("토큰이 올바르지 않습니다.")
                }
            }
        }
        
    }catch(e){
        result.message = e.message
        console.log("GET /group/ranking API ERR : ", e.message)
    }   

})

//그룹 종료 ~ 삭제하기 

module.exports = router