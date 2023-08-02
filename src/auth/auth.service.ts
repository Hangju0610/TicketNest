import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { LoginDto, SignUpDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) // 레포지토리를 서비스에 주입
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService, // jwt 의존성 주입
    private configService: ConfigService, // env 파일 읽게 하기 위함.
  ) {}

  async signUp(body: SignUpDto) {
    const { email, password, confirm, nickname } = body;
    if (!body.email || !body.password || !body.confirm || !body.nickname) {
      throw new BadRequestException({
        errorMessage: '데이터 형식이 잘못되었습니다.',
      });
    }

    if (password !== confirm) {
      throw new BadRequestException(
        '확인 비밀번호가 입력 비밀번호와 일치하지 않습니다.',
      );
    }
    const isExistEmailOrNickname = await this.userRepository.findOne({
      where: [{ email: email }, { nickname: nickname }],
    });

    if (isExistEmailOrNickname) {
      if (isExistEmailOrNickname.email === email) {
        throw new NotFoundException('이미 존재하는 이메일 입니다');
      }
      if (isExistEmailOrNickname.nickname === nickname) {
        throw new NotFoundException('이미 존재하는 닉네임 입니다');
      }
    }

    try {
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = this.userRepository.create({
        email,
        password: hashedPassword,
        nickname,
      });
      this.userRepository.save(user);
      return { message: '회원가입 성공' };
    } catch (err) {
      throw new InternalServerErrorException({
        errorMessage: '회원가입에 실패하였습니다',
      });
    }
  }

  async login(body: LoginDto) {
    // body.email, body.password 만 체크하면 될 거 같음.
    if (!body.email || !body.password) {
      throw new BadRequestException({
        errorMessage: '데이터 형식이 잘못되었습니다.',
      });
    }
    const { email, password } = body;

    try {
      const user = await this.userRepository.findOne({
        where: { email: email },
      });

      // 가입된 유저여야 하고 비밀번호가 일치해야 합니다
      if (user && (await bcrypt.compare(password, user.password))) {
        const payload = { email: user.email };
        const token = this.jwtService.sign(payload, {
          secret: this.configService.get('JWT_SECRET'),
        });
        return { token: `Bearer ${token}` };
      } else {
        throw new ForbiddenException({
          errorMessage: '이메일과 비밀번호를 확인해주세요',
        });
      }
    } catch (err) {
      throw new InternalServerErrorException({
        errorMessage: '로그인에 실패하였습니다',
      });
    }
  }
}
